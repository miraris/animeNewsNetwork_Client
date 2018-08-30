"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var convert = require("xml-js");
var bottleneck_1 = require("bottleneck");
var reqProm = require("request-promise");
var ANN_Client = /** @class */ (function () {
    function ANN_Client(ops) {
        this.ops = ops;
        this.reportsUrl = 'https://www.animenewsnetwork.com/encyclopedia/reports.xml?';
        this.detailsUrl = 'https://cdn.animenewsnetwork.com/encyclopedia//nodelay.api.xml?';
        this.limiter = new bottleneck_1.default({
            maxConcurrent: 1,
            minTime: (ops.apiBackOff || 10) * 1000
        });
    }
    ANN_Client.prototype.requestApi = function (url) {
        return this.limiter.schedule(function () { return reqProm.get(url); });
    };
    ANN_Client.prototype.findTitlesLike = function (titles) {
        var _this = this;
        var url = this.detailsUrl + 'title=~' + titles.join('&title=~');
        return this.requestApi(url)
            .then(function (xmlPage) {
            var ann = convert.xml2js(xmlPage, { compact: true, alwaysArray: true, trim: true, nativeType: true });
            _this.addDerivedValues(ann.ann && ann.ann[0]);
            return ann;
        })
            .catch(function (err) {
            if (err.error.indexOf("We're terribly sorry but an unexpected error occured while accessing this page.") !== -1) {
                if (_this.ops.debug)
                    console.debug('no results found', url, titles);
                return {};
            }
            throw err;
        });
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
        }
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
    return ANN_Client;
}());
exports.ANN_Client = ANN_Client;
//# sourceMappingURL=index.js.map