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
      Promise.all([ar, br])
        .then(([good, bears]) => {
          let end = Date.now();
          if (bears.ann && good.anime[0].d_mainTitle === bears.anime[0].d_mainTitle)
            throw "results were the same";
          if (end - start < (10 * 1000))
            throw "the api backoff did not wait 10 seconds";

          done();
        }, err => {
          throw err;
        });
    }.bind(null));

  });


  describe('Test that the api has not changed', function () {

    it('it should return expected data for given title', function (done) {
      ann.findTitlesLike(['cardcaptor sakura: clear card'])
        .then((resp) => {
          let res = resp.anime[0];

          //test anime
          if(res.g_genre || JSON.stringify(res.d_genre) !== "[\"adventure\",\"comedy\",\"magic\"]")
            throw new Error('incorrect genre given');
          if(res.d_mainTitle || res.d_mainTitle !== "Cardcaptor Sakura: Clear Card")
            throw new Error('incorrect mainTitle given');
          if(res.d_plotSummary || res.d_plotSummary !== "Sakura and Syaoran are starting junior high school. With the Final Judgment passed, Sakura thinks school life will be quiet, but then all her cards suddenly turn blank. The mysterious new power she discovers will change how she thinks about her powers. <em class=de-emphasized>(from manga)</em>")
            throw new Error('incorrect mainTitle given');
          if(res.d_dateReleased || res.d_dateReleased !== "Sat Jan 06 2018 19:00:00 GMT-0500 (EST)")
            throw new Error('incorrect date given');
          if (res.d_episodes.length < 20)
            throw new Error('incorrect episode length');

          //test episodes
          let episode = res.d_episodes[0];
          if (episode.occurrence !== 1)
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
        .then((mResp) => {
          let titlesFound = titles.filter(title => {
            let found = mResp.anime.reduce((p, c) => {
              return p || (c.d_mainTitle.toLowerCase() === title);
            }, false);
            return found;
          });
          if (titlesFound.length !== titles.length)
            throw "all titles were not found in response from multi title return";
          done();
        })
    })
  });
});
