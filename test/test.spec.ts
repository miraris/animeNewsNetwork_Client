
import {ANN_Client} from '../index';
import {Observable} from "rxjs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

describe('Testing the ANN api client', function () {
  this.timeout(15000);



  describe('This tests the API backoff', function () {
    it('Run two requests immediately that are called 10 seconds apart', function (done) {
      let ops2 = {apiBackOff: 10, caching:false};
      let annA = new ANN_Client(ops2);
      let ar = annA.findTitlesLike(['good']);
      let br = annA.findTitlesLike(['bears']);


      let start = Date.now();
      Observable.forkJoin(ar,br)
        .take(1)
        .subscribe(gb=>{
          let end = Date.now();
          let good = gb[0];
          let bears = gb[1];
          if(good && bears && good.length === bears.length)
            throw "results were the same";
          if(end - start < (10 * 1000))
            throw "the api backoff did not wait 10 seconds";

          done();
        }, err=>{
            throw err;
        });
    }.bind(null));
  });


  describe('Test that the api has not changed', function () {
    it('it should return expected data for given title', function (done) {
        let ops = {apiBackOff: 10, caching:false, groupTypeFilter:'anime'};
        let ann = new ANN_Client(ops);
        ann.findTitlesLike(['YU-NO: A girl who chants love at the bound of this world.'])
            .take(1)
            .subscribe((resp)=>{
                let res= resp[0];
                if(res.alternativeTitles[0] !== "kono yo no hate de koi o utau shōjo yu-no")
                    throw new Error('alt title 0 was incorrect');
                if(res.alternativeTitles[1] !== "この世の果てで恋を唄う少女yu-no")
                    throw new Error('alt title 1 was incorrect');
                if(res.dateEnded.getDate() !== 31)
                    throw new Error('dateEnded was incorrect');
                if(res.dateReleased.getDate() !== 31)
                    throw new Error('dateReleased was incorrect');
                if(res.occurrence !== 1)
                    throw new Error('occurrence was incorrect');
                if(res.title !== 'YU-NO: A girl who chants love at the bound of this world.')
                    throw new Error('title was incorrect');
                if(res.groupType !== 'anime')
                    throw new Error('title was incorrect');
                if(res.type !== 'TV')
                    throw new Error('type was incorrect');
                if(res.precision !== 'TV')
                    throw new Error('precision was incorrect');
                if(res._id !== 'https://cdn.animenewsnetwork.com/encyclopedia/api.xml?anime=20479')
                    throw new Error('_id was incorrect');

                done();
            });
    });

  it('it should return expected data for given title', function (done) {
      let ops = {apiBackOff: 10, caching:false, groupTypeFilter:'anime'};
      let ann = new ANN_Client(ops);
      ann.findTitlesLike(['cardcaptor sakura: clear card'])
          .take(1)
          .subscribe((resp)=>{
              let res= resp[0];
              if(res.alternativeTitles[0] !== "cardcaptor sakura: clear card-hen")
                  throw new Error('alt title 0 was incorrect');
              if(res.alternativeTitles[1] !== "カードキャプターさくら クリアカード編")
                  throw new Error('alt title 1 was incorrect');
              if(res.episodes.length < 20)
                  throw new Error('incorrect episode length');
              let episode = res.episodes[0];
              if(episode.language !== "EN")
                  throw new Error('the correct language was not given');
              if(episode.occurrence !== 1)
                  throw new Error('the incorrect occurrence was given');
              done();
          });
      });
  });

    describe('Test multi title searching', function () {
        it('it should return more data when searching for more titles', function (done) {
            let ops = {apiBackOff: 10, caching:false, groupTypeFilter:'anime'};
            let ann = new ANN_Client(ops);
            let titles = [
                'cardcaptor sakura: clear card',
                'yu-no: a girl who chants love at the bound of this world.'];

            ann.findTitlesLike(titles)
                .take(1)
                .subscribe((mResp)=>{
                    let titlesFound = titles.filter(title=>{
                        let found = mResp.reduce((p,c)=>{
                            return p || (c.title.toLowerCase() === title);
                        }, false);
                        return found;
                    });
                    if(titlesFound.length !== titles.length)
                        throw "all titles were not found in response from multi title return";
                    done();
                })
        })
    });
});
