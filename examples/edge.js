const Selenium = require('../lib/selenium-bootstrap.js');
const selenium = new Selenium({
  browserName: 'MicrosoftEdge'
});

selenium.run(function*(driver, webdriver) {
  yield driver.get('http://www.google.com/ncr');
  yield driver.findElement(webdriver.By.name('q')).sendKeys('webdriver');
  yield driver.findElement(webdriver.By.name('btnG')).click();
  yield driver.wait(webdriver.until.titleIs('webdriver - Google Search'), 5000);
  yield selenium.takeScreenshot();
});