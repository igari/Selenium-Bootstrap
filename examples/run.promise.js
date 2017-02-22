const Selen = require('../lib/selenium-bootstrap.js');
const selen = new Selen({
  browserName: 'chrome'
});

selen.run(function(driver, webdriver) {
  return driver.get('http://www.google.com/ncr')
    .then(function () {
      return driver.findElement(webdriver.By.name('q')).sendKeys('webdriver');
    })
    .then(function () {
      return driver.findElement(webdriver.By.name('btnG')).click();
    })
    .then(function () {
      return driver.wait(webdriver.until.titleIs('webdriver - Google Search'), 5000);
    })
    .then(function () {
      return selen.takeScreenshot();
    });
});
