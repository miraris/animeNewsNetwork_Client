
import {ANN_Client} from '../index';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

describe('Testing the ANN api client', function () {
  this.timeout(15000);

  let ops = {apiBackOff: 10};
  let ann = new ANN_Client(ops);

  describe('This tests the API backoff', function () {
    it('Run two requests immediately that are called 10 seconds apart', function (done) {
      let ar = ann.findTitlesLike(['good']);
      let br = ann.findTitlesLike(['bears']);

      let start = Date.now();
      Promise.all([ar,br])
        .then(([good, bears])=>{
          let end = Date.now();
          if(bears.ann && good.anime[0].d_mainTitle === bears.anime[0].d_mainTitle)
            throw "results were the same";
          if(end - start < (10 * 1000))
            throw "the api backoff did not wait 10 seconds";

          done();
        }, err=>{
            throw err;
        });
    }.bind(null));


    it('it should return a correct season', function (done) {
      ann.findTitlesLike(['Naruto Shippūden'])
        .then((resp)=>{
          let res= resp.anime.filter(an=>an.d_mainTitle === "Naruto Shippūden" && an.d_series === 2)[0];
          if(!res)
            throw new Error('the series returned did not match expected');
          done();
        });
    });
  });


  describe('Test that the api has not changed', function () {


  it('it should return expected data for given title', function (done) {
      ann.findTitlesLike(['cardcaptor sakura: clear card'])
          .then((resp)=>{
              let res= resp.anime[0];
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
            let titles = [
                'cardcaptor sakura: clear card',
                'jinki:extend'];

            ann.findTitlesLike(titles)
              .then((mResp)=>{
                    let titlesFound = titles.filter(title=>{
                        let found = mResp.anime.reduce((p,c)=>{
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
