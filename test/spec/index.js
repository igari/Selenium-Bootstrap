const Selen = require('../../lib/selen.js');
const selen = new Selen({
  browserName: 'chrome'
});

selen.describe('Get Title of each page', function () {
  selen.it('google', function*(driver, webdriver) {
    yield driver.get('http://www.google.com/ncr');
    yield driver.findElement(webdriver.By.name('q')).sendKeys('webdriver');
    yield driver.findElement(webdriver.By.name('btnG')).click();
    yield driver.wait(webdriver.until.titleIs('webdriver - Google Search'), 5000);
    yield this.executeScript(function () {
      windo.onload = function () {

      }
    })
  });
});

selen.describe('Get Title of each page', function () {
  selen.it('apple', function*(driver, webdriver) {
    yield driver.get('http://www.google.com/ncr');
    yield driver.findElement(webdriver.By.name('q')).sendKeys('webdriver');
    yield driver.findElement(webdriver.By.name('btnG')).click();
    yield driver.wait(webdriver.until.titleIs('webdriver - Google Search'), 5000);
  });
});

selen.run();