

import * as cheerio from "cheerio";
import {Observable, Subject, BehaviorSubject} from "rxjs";
import * as https from 'https';
import * as http from 'http';

class ANN_Client_Options {
    reportsUrl = 'https://www.animenewsnetwork.com/encyclopedia/reports.xml?';
    detailsUrl = 'https://cdn.animenewsnetwork.com/encyclopedia/api.xml?';

    groupTypeFilter = null;

    apiBackOff = 5;
    // timeUntilTitleUpdate = 60 * 60 * 24;

    cacheing = true;
    // cacheTimeout = 0;

    constructor(ops: any) {
        Object.assign(this, ops);
        if(!(this.groupTypeFilter === null || this.groupTypeFilter === "anime" || this.groupTypeFilter === "manga")) {
            throw new Error("not a correct type, anime, null, or manga must be given");
        }
    }

    get urlReports() {
        let url = this.reportsUrl;
        if(this.groupTypeFilter)
            url += "type=" + this.groupTypeFilter + '&';
        return url;
    }

    get urlDetails() {
        let url = this.detailsUrl;
        if(this.groupTypeFilter)
            url += "type=" + this.groupTypeFilter + '&';
        return url;
    }
}

export class ANN_Client {

    private requestStack = new Subject<Subject<boolean>>();
    private pageCache: {[url:string] : string} = {} as any;
    // private allTitles: {title: string} = {} as any;

    constructor(private ops: any){
        if(!(ops instanceof ANN_Client_Options))
            this.ops = new ANN_Client_Options(ops);

        this.initRequestStack();
        // this.updateTitlesList();
    }

    private initRequestStack(){
        Observable.zip(
            Observable.timer(0,this.ops.apiBackOff * 1000),
            this.requestStack)
            .subscribe((res: [number, Subject<boolean>])=>{
                res[1].next(true);
            });
    }

    //left for new series added, usage
    // private updateTitlesList(){
    //     this.requestApi(this.urlReports)
    //     .do(results=>{
    //         debugger; //structure
    //         this.allTitles = results;
    //     })
    //     .combineLatest(Observable.timer(0,this.ops.timeUntilTitleUpdate * 1000))
    //     .mergeMap(()=>{
    //         let url = this.ops.urlReports +'&nlist=50';
    //         return this.requestApi(url);
    //     })
    //     .subscribe((newlyAddedTitles)=>{
    //         debugger; //figure out the strucutre of the newly added titles
    //     })
    //
    // }

    private requestApi(url): Observable<{status: number, data:string}> {

        if(this.ops.cacheing && this.pageCache[url]) {
            return Observable.of({status: 200, data:this.pageCache[url]})
        } else {

            let ns = new BehaviorSubject<boolean>(false);

            this.requestStack.next(ns);

            return ns
                .asObservable()
                .filter(val=> {
                    return !!val
                })
                .take(1)
                .map((v: boolean): Observable<{status: number, data:string}> => {
                    return _createObsHttpGet(url);
                })
                .switch();
        }

        function _createObsHttpGet(url): Observable<{status: number, data:string}> {
            return Observable.create((obs)=> {
                https.get(url, (res: http.IncomingMessage) => {
                    if (res.statusCode !== 200) {
                        obs.next({status:res.statusCode, data:'not a 200 response'});
                        obs.complete();
                    } else {
                        res.setEncoding('utf8');
                        let rawData = '';
                        res.on('data', (chunk) => {
                            rawData += chunk;
                        });
                        res.on('end', () => {
                            obs.next({status:res.statusCode, data:rawData});
                            obs.complete();
                        });
                    }
                }).on('error', (error) => {
                    obs.next({status:500, data:error.message});
                    obs.complete();
                })
            })
        }
    }


    public findTitlesLike(titles: string[], theashold: number = 0.80): Observable<any[]> {
        let url = this.ops.urlDetails+'title=~'+titles.join('&title=~');
        return this.requestApi(url)
            .map(xmlPage=>{
                if(xmlPage.status === 200) {
                    let seriesModels = this.parseAllSeries(xmlPage.data);
                    let rm = seriesModels.filter(mod=> {
                        let probability: any = titles.map(title=> {
                                return {title: title, similarity: this.similarity(mod.title, title)};
                            }).sort((a, b)=> {
                                return b.similarity - a.similarity;
                            })[0] || {similarity: 0};

                        return probability.similarity >= theashold;
                    });
                    return rm;
                }
                return [];
            })

    }

    private parseAllSeries(xmlPage) {
        let $ = cheerio.load(xmlPage, {
            normalizeWhitespace: true,
            xmlMode: true
        });

        let seriesModels = [];
        let thiss = this;
        $('ann').children().each(function (i, ele) {

            if (!ele.name ||
                ele.name === 'warning' ||
                thiss.ops.groupTypeFilter &&
                thiss.ops.groupTypeFilter !== ele.name)
                return;

            let seriesModel = {} as any;

            let id = this.attribs['id'];

            seriesModel.groupType = ele.name;

            if (seriesModel.groupType && id)
                seriesModel._id = thiss.ops.detailsUrl + seriesModel.groupType + "=" + id;

            seriesModel.type = this.attribs['type'];
            seriesModel.precision = this.attribs['precision'];

            let occur = this.attribs['precision'];
            if (typeof occur !== 'undefined')
                occur = parseInt(occur.replace(/[^0-9]/g, ''), 10);
            seriesModel.occurrence = occur || 1;

            seriesModel.title = $(ele).find('info[type="Main title"]').text();

            let altT = $(ele).find('info[type="Alternative title"]')
                .map(function (i, el) {
                    return $(this).text().toLocaleLowerCase();
                }).get();
            if(altT && altT.length)
                seriesModel.alternativeTitles = altT;

            $(ele).find('info[type="Genres"]')
                .each(function (i, el) {
                    let genre = $(this).text().toLowerCase();
                    seriesModel[genre] = true;
                });

            let summary = $(ele).find('info[type="Plot Summary"]').text();
            if(summary)
                seriesModel.summary = summary;

            let date = $(ele).find('info[type="Vintage"]')
                .map(function (i, el) {
                    return $(this).text();
                })
                .get()
                .reduce((p,datesS)=>{
                    let splitDates = datesS.split(" to ");
                    return p.concat(splitDates);
                }, [])
                .map(da=>{
                    let clean = da.match(/(?:[0-9]{0,4})?(?:-[0-9]{0,2})?(?:-[0-9]{0,2})?/);
                    return clean && clean[0] && new Date(clean[0]) || null;
                })
                .sort(function(a,b){
                    return a > b;
                });

            if (date.length && date[0])
                seriesModel.dateReleased = date[0];
            if (date.length && date[date.length-1])
                seriesModel.dateEnded = date[date.length-1];

            $(ele).find('episode').each(function (i, eleE) {
                $(this).find('title').each(function (i, eleT) {
                    let baseOcc = +$(eleE).attr('num');
                    let episode = {
                        occurrence:  baseOcc && baseOcc + (1 - 1 / (i+1)) || -1,
                        language: $(eleT).attr('lang') || "",
                        title: $(eleT).text() || "",
                    };

                    let arr = (seriesModel.episodes || []);
                    arr.push(episode);
                    seriesModel.episodes = arr;
                });
            });

            seriesModels.push(seriesModel);
        });

        return seriesModels;

    }








    private similarity(s1, s2) {
        var longer = s1.toLowerCase();
        var shorter = s2.toLowerCase();
        if (s1.length < s2.length) {
            longer = s2.toLowerCase();
            shorter = s1.toLowerCase();
        }

        if (longer.length == 0 && shorter.length == 0) {
            return 0;
        }

        var longerLength = longer.length;
        let distance = (longerLength - this.editDistance(longer, shorter)) / parseFloat(longerLength);
        let add = (longer.indexOf(shorter) != -1? distance+0.70 : distance);
        return (add > 1? 1: add);
    }

    private editDistance(s1, s2) {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();

        var costs = new Array();
        for (var i = 0; i <= s1.length; i++) {
            var lastValue = i;
            for (var j = 0; j <= s2.length; j++) {
                if (i == 0)
                    costs[j] = j;
                else {
                    if (j > 0) {
                        var newValue = costs[j - 1];
                        if (s1.charAt(i - 1) != s2.charAt(j - 1))
                            newValue = Math.min(Math.min(newValue, lastValue),
                                    costs[j]) + 1;
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0)
                costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }
}
