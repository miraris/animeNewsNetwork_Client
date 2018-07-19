import { Observable } from "rxjs";
export declare class ANN_Client {
    private ops;
    private requestStack;
    private pageCache;
    constructor(ops: any);
    private initRequestStack;
    private requestApi;
    findTitlesLike(titles: string[], theashold?: number): Observable<any[]>;
    private parseAllSeries;
    private similarity;
    private editDistance;
}
