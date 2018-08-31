import * as convert from 'xml-js';
import Bottleneck from "bottleneck"
import * as reqProm from 'request-promise';
import {fromPromise} from "rxjs/internal-compatibility";
import {map, retry, retryWhen, tap} from "rxjs/operators";
import {defer} from "rxjs";

export class ANN_Client {

  private reportsUrl = 'https://www.animenewsnetwork.com/encyclopedia/reports.xml?';
  private detailsUrl = 'https://cdn.animenewsnetwork.com/encyclopedia//nodelay.api.xml?';

  private limiter;

  constructor(private ops: {apiBackOff?: number, useDerivedValues?: boolean}) {

    Object.assign(this.ops,{apiBackOff: 10, useDerivedValues: true}, ops);
    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: ops.apiBackOff * 1000
    });
  }


  private requestApi(url): Promise<any> {

    return defer(()=>fromPromise(request.call(this, encodeURI(url)))).pipe(
      retry(5))
      .toPromise()
      .then(parse.bind(this));

    function request(uri){
      return  this.limiter.schedule(()=>reqProm({
        uri
      }))
    }

    function parse(xmlPage){
      let ann = convert.xml2js(xmlPage,
        {compact: true, alwaysArray: true, trim: true, nativeType: true}) as any;
      return ann;
    }
  }

  public findTitleWithId(id: string): Promise<any> {
    if(!id)
      return Promise.resolve({});

    let url = this.detailsUrl + 'title='+id;
    let ret =  this.requestApi(url);
    if(this.ops.useDerivedValues)
      return ret.then((ann)=>this.addDerivedValues(ann.ann && ann.ann[0]));
    return ret;
  }

  public findTitlesLike(titles: string[]): Promise<any> {
    let url = this.detailsUrl + 'title=~' + titles.join('&title=~');
    let ret =  this.requestApi(url);
    if(this.ops.useDerivedValues)
      return ret.then((ann)=>this.addDerivedValues(ann.ann && ann.ann[0]));
    return ret;
  }

  private addDerivedValues(ann): Promise<any>{
    if(ann.anime) {
      ann.anime.forEach(an => {
        if (an.info) {
          an.d_genre = this.getMany(an.info, 'Genres');
          an.d_mainTitle = this.getSingle(an.info, 'Main title');
          an.d_plotSummary = this.getSingle(an.info, 'Plot Summary');
        }
        if (an.episode)
          an.d_episodes = an.episode &&
            an.episode.map(ep => {
              let ret = {} as any;
              if (ep.title && ep.title[0]._text) ret.title = ep.title[0]._text[0];
              if (ep._attributes && ep._attributes.num) ret.occurrence = +ep._attributes.num;
              return ret;
            }) || [];
      });
      return Promise.all(ann.anime.map(an=>{
        return this.fetchSeries(an)
          .then(series=>{
            if(series)
              an.d_series = series;
            return an;
          })
      })).then(anime=>{
        ann.anime = anime;
        return ann;
      })
    }
    return Promise.resolve(ann);
  }

  private getMany(info, key, retKey = ''){
    return  info
      .filter(val => val._attributes && val._attributes.type === key)
      .map(gen=> (gen._attributes[retKey] || gen['_text'][0])) || [];
  }

  private getSingle(info, key, retKey = ''){
    let sing = info.filter(val => val._attributes && val._attributes.type === key);
    if(sing.length && ((sing[0]._attributes && sing[0]._attributes[retKey]) || sing[0]['_text']))
      return sing[0]._attributes[retKey] || sing[0]['_text'][0];
  }

  private fetchSeries(anime) {
    if (anime._attributes && anime._attributes.type)
      switch (anime._attributes.type) {
        case 'TV':
          return getSeriesFromTV.call(this, anime);
      }
      return Promise.resolve();

    function getSeriesFromTV(anime) {
      let season = 1;
      let id = getPrevId(anime);
      return defer(() => fromPromise(getAnimeById.call(this,id))).pipe(
        map((res: any) => {
          if (res && res.ann && res.ann[0].anime && res.ann[0].anime[0]) {
            ++season;
            anime = res.ann[0].anime[0];
            id = getPrevId(anime);
            if(id) {
              throw 'retry';
            }
          }
          return season;
        }),
        retryWhen(errors =>{
          return errors.pipe(tap(err=>{
            if(err !== 'retry')
              throw err;
          }))
        })).toPromise();

      function getPrevId(anime) {
        return anime && anime['related-prev'] &&
          anime['related-prev'][0]._attributes &&
          anime['related-prev'][0]._attributes.rel === 'sequel of' &&
          anime['related-prev'][0]._attributes.id
      }

      function getAnimeById(id){
        if(!id)
          return Promise.resolve();

        let url = this.detailsUrl + 'title='+id;
        return this.requestApi(url);
      }
    }
  }
}
