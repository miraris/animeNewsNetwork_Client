
# Description
A javascript parser for Anime News Network, is meant to run in a NodeJS environment

# Dependencies
1) NodeJs
2) RxJs
3) Bottelneck

# Example
```typescript
let ops = {apiBackOff: 10};
      let ann = new ANN_Client(ops);
      let ar = ann.findTitlesLike(['good']);
```
      
      
# Classes
// this is the main class
```typescript
export class ANN_Client {
    
    //default {apiBackOff: 10, useDerivedValues: true}
    //back off uses 
    //https://www.npmjs.com/package/bottleneck
    constructor(private ops: {apiBackOff?: number, useDerivedValues?: boolean});
    
    /*
    return types are derived from 
    https://www.npmjs.com/package/xml-js
    
    convert.xml2js(xmlPage, {compact: true, alwaysArray: true, trim: true, nativeType: true})
    useDerivedValues = true; adds derived types, they can take a while as they are fetched from multiple calls
    anime.d_genre: string[]
    anime.d_mainTitle: string;
    anime.d_plotSummary: string;
    anime.d_episodes: {title: string, occurrence: number};
    anime.d_series: number; // 1 or 2 or 3 .... for type anime.type === 'TV' (for now)
     */
    findTitlesLike(titles: string[]): Promise<any>; 
    
    findTitleWithId(id: string): Promise<any>;
    
}



```
