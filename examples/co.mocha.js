const webdriver = require("selenium-webdriver");
const fs = require('fs');
const Mocha = require('mocha');
require('co-mocha')(Mocha);

describe('Search and Get Title', function () {
  this.timeout(100000);
  let driver;
  before(function () {
    return driver = new webdriver.Builder()
      .withCapabilities({
        browserName: 'chrome'
      })
      .build()
  });
  after(function () {
    return driver.quit();
  });
  it('google', function*() {
    yield driver.get('http://www.google.com/ncr');
    yield driver.findElement(webdriver.By.name('q')).sendKeys('webdriver');
    yield driver.findElement(webdriver.By.name('btnG')).click();
    yield driver.wait(webdriver.until.titleIs('webdrier - Google Search'), 5000).catch((e) => {
      return driver.takeScreenshot().then((image, err) => {
        fs.writeFileSync('out.png', image, 'base64');
        return Promise.reject(e)
      });
    });
  });
});

