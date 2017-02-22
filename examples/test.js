const Selen = require('../lib/selen.js');
const selen = new Selen({
  browserName: 'chrome'
});

describe('Search and Get Title', function () {
  it('google', function*(driver, webdriver) {
    yield driver.get('http://www.google.com/ncr');
    yield driver.findElement(webdriver.By.name('q')).sendKeys('webdriver');
    yield driver.findElement(webdriver.By.name('btnG')).click();
    yield driver.wait(webdriver.until.titleIs('ebdriver - Google Search'), 5000);
  });
});

selen.run();

