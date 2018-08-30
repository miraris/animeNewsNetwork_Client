export declare class ANN_Client {
    private ops;
    reportsUrl: string;
    detailsUrl: string;
    limiter: any;
    constructor(ops: any);
    private requestApi;
    findTitlesLike(titles: string[]): Promise<any>;
    addDerivedValues(ann: any): void;
    getMany(info: any, key: any, retKey?: string): any;
    getSingle(info: any, key: any, retKey?: string): any;
}
