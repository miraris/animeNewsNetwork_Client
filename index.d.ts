import { Observable } from "rxjs";
export declare class ANN_Client {
    private ops;
    private requestStack;
    private pageCache;
    constructor(ops: any);
    private initRequestStack();
    private requestApi(url);
    findTitlesLike(titles: string[], theashold?: number): Observable<any[]>;
    private parseAllSeries(xmlPage);
    private similarity(s1, s2);
    private editDistance(s1, s2);
}
