import * as convert from 'xml-js';
import Bottleneck from "bottleneck"
import * as reqProm from 'request-promise';

export class ANN_Client {

  reportsUrl = 'https://www.animenewsnetwork.com/encyclopedia/reports.xml?';
  detailsUrl = 'https://cdn.animenewsnetwork.com/encyclopedia//nodelay.api.xml?';

  limiter;

  constructor(private ops: any) {
    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: (ops.apiBackOff || 10) * 1000
    });
  }


  private requestApi(url): Promise<any> {
    return this.limiter.schedule(()=>reqProm.get(url));
  }


  public findTitlesLike(titles: string[]): Promise<any> {
    let url = this.detailsUrl + 'title=~' + titles.join('&title=~');
    return this.requestApi(url)
      .then(xmlPage => {
        let ann = convert.xml2js(xmlPage,
          {compact: true, alwaysArray: true, trim: true, nativeType: true}) as any;
        this.addDerivedValues(ann.ann && ann.ann[0]);

        return ann;
      })
      .catch(err=>{
        if(err.error.indexOf("We're terribly sorry but an unexpected error occured while accessing this page.") !== -1) {
          if(this.ops.debug)
            console.debug('no results found', url, titles);
          return {};
        }
        throw err;
      })

  }

  addDerivedValues(ann){
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
      })
    }
  }

  getMany(info, key, retKey = ''){
    return  info
      .filter(val => val._attributes && val._attributes.type === key)
      .map(gen=> (gen._attributes[retKey] || gen['_text'][0])) || [];
  }

  getSingle(info, key, retKey = ''){
    let sing = info.filter(val => val._attributes && val._attributes.type === key);
    if(sing.length && ((sing[0]._attributes && sing[0]._attributes[retKey]) || sing[0]['_text']))
      return sing[0]._attributes[retKey] || sing[0]['_text'][0];
  }
}
