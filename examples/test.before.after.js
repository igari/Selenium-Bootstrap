const Selen = require('../lib/selen.js');
const selen = new Selen({
  browserName: 'chrome'
});

describe('Search and Get Title', function () {
  before(function () {
    return new Promise(function (resolve) {
      setTimeout(function () {
        console.log('do before all')
        resolve();
      }, 3000);
    })
  });
  after(function (done) {
    setTimeout(function () {
      console.log('do after all')
      done();
    }, 2000);
  });
  beforeEach(function () {
    console.log('do before each')
  });
  afterEach(function () {
    console.log('do after each')
  });

  it('google', function*(driver, webdriver) {
    yield driver.get('http://www.google.com/ncr');
    yield driver.findElement(webdriver.By.name('q')).sendKeys('webdriver');
    yield driver.findElement(webdriver.By.name('btnG')).click();
    yield driver.wait(webdriver.until.titleIs('webdriver - Google Search'), 5000);
  });
});

selen.run();