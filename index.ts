

import * as $ from "cheerio";
import {Subscription, Observable, Subject, BehaviorSubject} from "rxjs";

class ANN_Client_Options {
    reportsUrl = 'https://www.animenewsnetwork.com/encyclopedia/reports.xml?';
    detailsUrl = 'http://cdn.animenewsnetwork.com/encyclopedia/api.xml?';

    typeFilter = null;

    apiBackOff = 5;
    // timeUntilTitleUpdate = 60 * 60 * 24;

    constructor(ops: any) {
        Object.assign(this, ops);
        if(this.typeFilter !== null || this.typeFilter !== "anime" || this.typeFilter !=="manga")
            throw new Error("not a correct type, anime, null, or manga must be given");
    }

    get urlReports() {
        return this.reportsUrl + "type=" + this.typeFilter;
    }

    get urlDetails() {
        return this.detailsUrl + "type=" + this.typeFilter;
    }
}

export class ANN_Client {

    private requestStack: BehaviorSubject = new BehavorialSubject(null);

    private allTitles: {title: string} = {} as any;

    constructor(private ops: ANN_Client_Options){
        if(!(ops instanceof ANN_Client_Options))
            this.ops = new ANN_Client_Options(ops);

        this.initRequestStack();
        // this.updateTitlesList();
    }

    private initRequestStack(){
        Observable.concat(
            Observable.timer(0,this.ops.apiBackOff * 1000),
            this.requestStack)
        .subscribe((res: [Subject, number])=>{
            if(res && res.length)
                res[0].next(null);
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

    private requestApi(url) {
        let ns = new Subject();
        this.requestStack.next(ns);
        return ns
            .asObservable()
            .take(1)
            .map(v=> {
                return _createObsHttpGet(url);
            })
            .switch();

        function _createObsHttpGet(url){
            return Observable.create((obs)=> {
                http.get(url, (res) => {
                    if (statusCode !== 200) {
                        obs.error(error.message);
                    } else {
                        debugger;//check res.data exists
                        res.next(res.data);
                        res.complete();
                    }
                }).on('error', (error) => {
                    obs.error(error.message);
                })
            })
        }
    }


    public series_findTitlesLike(title: string, theashold: number) {
        let url = this.ops.urlDetails+'&title=~'+title.join('titles=~');
        this.requestApi(url)
            .map(xmlPage=>{
                let seriesModels = this.parseAllSeries(xmlPage);
                let rm = seriesModels.filter(mod=>{
                    let probability = this.similiarity(mod.title, title);
                    return probability >= theashold;
                });
                return rm;
            })

    }

    parseAllSeries(xmlPage) {
        let $ = cheerio.load(xmlPage, {
            normalizeWhitespace: true,
            xmlMode: true
        });

        let seriesModels = [];
        $('ann').children().each(function(i, ele){
            debugger; //check ele to find its type
            if(this.ops.typeFilter && this.ops.typeFilter !== ele)
                continue;

            let seriesModel = {};

            let id = $(ele).attr('id').text();
            debugger;//need to verify this //looking for anime or manga
            let nodeType = ele.nodeType;
            if(seriesModel.nodeType && id)
                seriesModel._id = this.ops.detailsUrl+seriesModel.type+"="+id;

            seriesModel.type = $(ele).attr('type').text();
            let occur = $(ele).attr('precision').text();
            seriesModel.occurrence = 0;
            if(typeof occur !== 'undefined')
                occur = parseInt(occur.replace(/[^0-9]/g, ''), 10);
                if(occur)
                    seriesModel.occurrence = occur;

            seriesModel.occurrence =
            seriesModel.title= $(ele).find('info[type=Main title]').text();
            seriesModel.alternativeTitles = $(ele).find('info[type=Alternative title]')
                .map(function(i, el) {
                    return $(this).text();
                }).get();
            seriesModel.genre = $(ele).find('info[type=Alternative title]')
                .each(function(i, el) {
                    let genre = $(this).text();
                    seriesModel[genre]=true;
                });
            seriesModel.summary = $(ele).find('info[type=Plot Summary]').text();
            let date = $(ele).find('info[type=Vintage]').text();
            if(date)
                seriesModel.dateReleased = new Date(date);


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
        let distance = (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
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