"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var cheerio = require("cheerio");
var rxjs_1 = require("rxjs");
var https = require("https");
var ANN_Client_Options = /** @class */ (function () {
    // cacheTimeout = 0;
    function ANN_Client_Options(ops) {
        this.reportsUrl = 'https://www.animenewsnetwork.com/encyclopedia/reports.xml?';
        this.detailsUrl = 'https://cdn.animenewsnetwork.com/encyclopedia/api.xml?';
        this.groupTypeFilter = null;
        this.apiBackOff = 5;
        // timeUntilTitleUpdate = 60 * 60 * 24;
        this.cacheing = true;
        Object.assign(this, ops);
        if (!(this.groupTypeFilter === null || this.groupTypeFilter === "anime" || this.groupTypeFilter === "manga")) {
            throw new Error("not a correct type, anime, null, or manga must be given");
        }
    }
    Object.defineProperty(ANN_Client_Options.prototype, "urlReports", {
        get: function () {
            var url = this.reportsUrl;
            if (this.groupTypeFilter)
                url += "type=" + this.groupTypeFilter + '&';
            return url;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ANN_Client_Options.prototype, "urlDetails", {
        get: function () {
            var url = this.detailsUrl;
            if (this.groupTypeFilter)
                url += "type=" + this.groupTypeFilter + '&';
            return url;
        },
        enumerable: true,
        configurable: true
    });
    return ANN_Client_Options;
}());
var ANN_Client = /** @class */ (function () {
    // private allTitles: {title: string} = {} as any;
    function ANN_Client(ops) {
        this.ops = ops;
        this.requestStack = new rxjs_1.Subject();
        this.pageCache = {};
        if (!(ops instanceof ANN_Client_Options))
            this.ops = new ANN_Client_Options(ops);
        this.initRequestStack();
        // this.updateTitlesList();
    }
    ANN_Client.prototype.initRequestStack = function () {
        rxjs_1.Observable.zip(rxjs_1.Observable.timer(0, this.ops.apiBackOff * 1000), this.requestStack)
            .subscribe(function (res) {
            res[1].next(true);
        });
    };
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
    ANN_Client.prototype.requestApi = function (url) {
        if (this.ops.cacheing && this.pageCache[url]) {
            return rxjs_1.Observable.of({ status: 200, data: this.pageCache[url] });
        }
        else {
            var ns = new rxjs_1.BehaviorSubject(false);
            this.requestStack.next(ns);
            return ns
                .asObservable()
                .filter(function (val) {
                return !!val;
            })
                .take(1)
                .map(function (v) {
                return _createObsHttpGet(url);
            })
                .switch();
        }
        function _createObsHttpGet(url) {
            return rxjs_1.Observable.create(function (obs) {
                https.get(url, function (res) {
                    if (res.statusCode !== 200) {
                        obs.next({ status: res.statusCode, data: 'not a 200 response' });
                        obs.complete();
                    }
                    else {
                        res.setEncoding('utf8');
                        var rawData_1 = '';
                        res.on('data', function (chunk) {
                            rawData_1 += chunk;
                        });
                        res.on('end', function () {
                            obs.next({ status: res.statusCode, data: rawData_1 });
                            obs.complete();
                        });
                    }
                }).on('error', function (error) {
                    obs.next({ status: 500, data: error.message });
                    obs.complete();
                });
            });
        }
    };
    ANN_Client.prototype.findTitlesLike = function (titles, theashold) {
        var _this = this;
        if (theashold === void 0) { theashold = 0.80; }
        var url = this.ops.urlDetails + 'title=~' + titles.join('titles=~');
        return this.requestApi(url)
            .map(function (xmlPage) {
            if (xmlPage.status === 200) {
                var seriesModels = _this.parseAllSeries(xmlPage.data);
                var rm = seriesModels.filter(function (mod) {
                    var probability = titles.map(function (title) {
                        return { title: title, similarity: _this.similarity(mod.title, title) };
                    }).sort(function (a, b) {
                        return a.similarity - b.similarity;
                    })[0] || { similarity: 0 };
                    return probability.similarity >= theashold;
                });
                return rm;
            }
            return [];
        });
    };
    ANN_Client.prototype.parseAllSeries = function (xmlPage) {
        var $ = cheerio.load(xmlPage, {
            normalizeWhitespace: true,
            xmlMode: true
        });
        var seriesModels = [];
        var thiss = this;
        $('ann').children().each(function (i, ele) {
            if (!ele.name ||
                ele.name === 'warning' ||
                thiss.ops.groupTypeFilter &&
                    thiss.ops.groupTypeFilter !== ele.name)
                return;
            var seriesModel = {};
            var id = this.attribs['id'];
            seriesModel.groupType = ele.name;
            if (seriesModel.groupType && id)
                seriesModel._id = thiss.ops.detailsUrl + seriesModel.groupType + "=" + id;
            seriesModel.type = this.attribs['type'];
            seriesModel.precision = this.attribs['precision'];
            var occur = this.attribs['precision'];
            if (typeof occur !== 'undefined')
                occur = parseInt(occur.replace(/[^0-9]/g, ''), 10);
            seriesModel.occurrence = occur || 1;
            seriesModel.title = $(ele).find('info[type="Main title"]').text();
            var altT = $(ele).find('info[type="Alternative title"]')
                .map(function (i, el) {
                return $(this).text().toLocaleLowerCase();
            }).get();
            if (altT && altT.length)
                seriesModel.alternativeTitles = altT;
            $(ele).find('info[type="Genres"]')
                .each(function (i, el) {
                var genre = $(this).text().toLowerCase();
                seriesModel[genre] = true;
            });
            var summary = $(ele).find('info[type="Plot Summary"]').text();
            if (summary)
                seriesModel.summary = summary;
            var date = $(ele).find('info[type="Vintage"]')
                .map(function (i, el) {
                return $(this).text();
            })
                .get()
                .reduce(function (p, datesS) {
                var splitDates = datesS.split(" to ");
                return p.concat(splitDates);
            }, [])
                .map(function (da) {
                var clean = da.match(/(?:[0-9]{0,4})?(?:-[0-9]{0,2})?(?:-[0-9]{0,2})?/);
                return clean && clean[0] && new Date(clean[0]) || null;
            })
                .sort(function (a, b) {
                return a > b;
            });
            if (date.length && date[0])
                seriesModel.dateReleased = date[0];
            if (date.length && date[date.length - 1])
                seriesModel.dateEnded = date[date.length - 1];
            $(ele).find('episode').each(function (i, eleE) {
                $(this).find('title').each(function (i, eleT) {
                    var baseOcc = +$(eleE).attr('num');
                    var episode = {
                        occurrence: baseOcc && baseOcc + (1 - 1 / (i + 1)) || -1,
                        language: $(eleT).attr('lang') || "",
                        title: $(eleT).text() || "",
                    };
                    var arr = (seriesModel.episodes || []);
                    arr.push(episode);
                    seriesModel.episodes = arr;
                });
            });
            seriesModels.push(seriesModel);
        });
        return seriesModels;
    };
    ANN_Client.prototype.similarity = function (s1, s2) {
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
        var distance = (longerLength - this.editDistance(longer, shorter)) / parseFloat(longerLength);
        var add = (longer.indexOf(shorter) != -1 ? distance + 0.70 : distance);
        return (add > 1 ? 1 : add);
    };
    ANN_Client.prototype.editDistance = function (s1, s2) {
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
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0)
                costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    };
    return ANN_Client;
}());
exports.ANN_Client = ANN_Client;
//# sourceMappingURL=index.js.map