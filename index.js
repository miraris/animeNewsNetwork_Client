"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var convert = require("xml-js");
var bottleneck_1 = require("bottleneck");
var reqProm = require("request-promise");
var internal_compatibility_1 = require("rxjs/internal-compatibility");
var operators_1 = require("rxjs/operators");
var rxjs_1 = require("rxjs");
var ANN_Client = /** @class */ (function () {
    function ANN_Client(ops) {
        this.ops = ops;
        this.reportsUrl = 'https://www.animenewsnetwork.com/encyclopedia/reports.xml?';
        this.detailsUrl = 'https://cdn.animenewsnetwork.com/encyclopedia//nodelay.api.xml?';
        Object.assign(this.ops, { apiBackOff: 10, useDerivedValues: true }, ops);
        this.limiter = new bottleneck_1.default({
            maxConcurrent: 1,
            minTime: ops.apiBackOff * 1000
        });
    }
    ANN_Client.prototype.requestApi = function (url) {
        var _this = this;
        return rxjs_1.defer(function () { return internal_compatibility_1.fromPromise(request.call(_this, encodeURI(url))); }).pipe(operators_1.retry(5))
            .toPromise()
            .then(parse.bind(this));
        function request(uri) {
            return this.limiter.schedule(function () { return reqProm({
                uri: uri
            }); });
        }
        function parse(xmlPage) {
            var ann = convert.xml2js(xmlPage, { compact: true, alwaysArray: true, trim: true, nativeType: true });
            return ann;
        }
    };
    ANN_Client.prototype.findTitleWithId = function (id) {
        var _this = this;
        if (!id)
            return Promise.resolve({});
        var url = this.detailsUrl + 'title=' + id;
        var ret = this.requestApi(url);
        if (this.ops.useDerivedValues)
            return ret.then(function (ann) { return _this.addDerivedValues(ann.ann && ann.ann[0]); });
        return ret;
    };
    ANN_Client.prototype.findTitlesLike = function (titles) {
        var _this = this;
        var url = this.detailsUrl + 'title=~' + titles.join('&title=~');
        var ret = this.requestApi(url);
        if (this.ops.useDerivedValues)
            return ret.then(function (ann) { return _this.addDerivedValues(ann.ann && ann.ann[0]); });
        return ret;
    };
    ANN_Client.prototype.addDerivedValues = function (ann) {
        var _this = this;
        if (ann.anime) {
            ann.anime.forEach(function (an) {
                if (an.info) {
                    an.d_genre = _this.getMany(an.info, 'Genres');
                    an.d_mainTitle = _this.getSingle(an.info, 'Main title');
                    an.d_plotSummary = _this.getSingle(an.info, 'Plot Summary');
                }
                if (an.episode)
                    an.d_episodes = an.episode &&
                        an.episode.map(function (ep) {
                            var ret = {};
                            if (ep.title && ep.title[0]._text)
                                ret.title = ep.title[0]._text[0];
                            if (ep._attributes && ep._attributes.num)
                                ret.occurrence = +ep._attributes.num;
                            return ret;
                        }) || [];
            });
            return Promise.all(ann.anime.map(function (an) {
                return _this.fetchSeries(an)
                    .then(function (series) {
                    if (series)
                        an.d_series = series;
                    return an;
                });
            })).then(function (anime) {
                ann.anime = anime;
                return ann;
            });
        }
        return Promise.resolve(ann);
    };
    ANN_Client.prototype.getMany = function (info, key, retKey) {
        if (retKey === void 0) { retKey = ''; }
        return info
            .filter(function (val) { return val._attributes && val._attributes.type === key; })
            .map(function (gen) { return (gen._attributes[retKey] || gen['_text'][0]); }) || [];
    };
    ANN_Client.prototype.getSingle = function (info, key, retKey) {
        if (retKey === void 0) { retKey = ''; }
        var sing = info.filter(function (val) { return val._attributes && val._attributes.type === key; });
        if (sing.length && ((sing[0]._attributes && sing[0]._attributes[retKey]) || sing[0]['_text']))
            return sing[0]._attributes[retKey] || sing[0]['_text'][0];
    };
    ANN_Client.prototype.fetchSeries = function (anime) {
        if (anime._attributes && anime._attributes.type)
            switch (anime._attributes.type) {
                case 'TV':
                    return getSeriesFromTV.call(this, anime);
            }
        return Promise.resolve();
        function getSeriesFromTV(anime) {
            var _this = this;
            var season = 1;
            var id = getPrevId(anime);
            return rxjs_1.defer(function () { return internal_compatibility_1.fromPromise(getAnimeById.call(_this, id)); }).pipe(operators_1.map(function (res) {
                if (res && res.ann && res.ann[0].anime && res.ann[0].anime[0]) {
                    ++season;
                    anime = res.ann[0].anime[0];
                    id = getPrevId(anime);
                    if (id) {
                        throw 'retry';
                    }
                }
                return season;
            }), operators_1.retryWhen(function (errors) {
                return errors.pipe(operators_1.tap(function (err) {
                    if (err !== 'retry')
                        throw err;
                }));
            })).toPromise();
            function getPrevId(anime) {
                return anime && anime['related-prev'] &&
                    anime['related-prev'][0]._attributes &&
                    anime['related-prev'][0]._attributes.rel === 'sequel of' &&
                    anime['related-prev'][0]._attributes.id;
            }
            function getAnimeById(id) {
                if (!id)
                    return Promise.resolve();
                var url = this.detailsUrl + 'title=' + id;
                return this.requestApi(url);
            }
        }
    };
    return ANN_Client;
}());
exports.ANN_Client = ANN_Client;
//# sourceMappingURL=index.js.map