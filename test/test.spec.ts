
import {ANN_Client} from '../index';
import {Observable} from "rxjs";

describe('Testing the ANN api client', function () {
  this.timeout(15000);



  describe('This tests the API backoff', function () {
    it('Run two requests immediately that are called 10 seconds apart', function (done) {
      let ops = {apiBackOff: 10, caching:false};
      let ann = new ANN_Client(ops);
      let ar = ann.findTitlesLike(['good']);
      let br = ann.findTitlesLike(['bears']);

      let start = Date.now();
      Observable.forkJoin(ar,br)
        .subscribe(()=>{
          let end = Date.now();
          if(end - start < 10)
            throw "the api backoff did not wait 10 seconds";

          done();
        });
    });
  });


  describe('Test that the api has not changed', function () {
    it('it should return expected data for given title', function (done) {

    });
  })
});
