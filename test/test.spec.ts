
import {ANN_Client} from '../index';

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
      Promise.all([ar,br])
        .then(([good, bears])=>{
          let end = Date.now();
          if(bears.ann && good.ann[0].anime[0].d_mainTitle === bears.ann[0].anime[0].d_mainTitle)
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
      ann.findTitlesLike(['cardcaptor sakura: clear card'])
          .then((resp)=>{
              let res= resp.ann[0].anime[0];
              if(res.d_episodes.length < 20)
                  throw new Error('incorrect episode length');
              let episode = res.d_episodes[0];
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
                'jinki:extend'];

            ann.findTitlesLike(titles)
              .then((mResp)=>{
                    let titlesFound = titles.filter(title=>{
                        let found = mResp.ann[0].anime.reduce((p,c)=>{
                            return p || (c.d_mainTitle.toLowerCase() === title);
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
