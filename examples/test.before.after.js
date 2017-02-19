const Selen = require('../lib/selen.js');
const selen = new Selen({
  browserName: 'chrome'
});

selen.describe('Get Title of Google page', function () {
  selen.before(function () {
    return new Promise(function (resolve) {
      setTimeout(function () {
        console.log('do before all')
        resolve();
      }, 3000);
    })
  });
  selen.after(function (done) {
    setTimeout(function () {
      console.log('do after all')
      done();
    }, 2000);
  });
  selen.beforeEach(function () {
    console.log('do before each')
  });
  selen.afterEach(function () {
    console.log('do after each')
  });

  selen.it('google', function*(driver, webdriver) {
    yield driver.get('http://www.google.com/ncr');
    yield driver.findElement(webdriver.By.name('q')).sendKeys('webdriver');
    yield driver.findElement(webdriver.By.name('btnG')).click();
    yield driver.wait(webdriver.until.titleIs('webdriver - Google Search'), 5000);
  });
});

selen.run();