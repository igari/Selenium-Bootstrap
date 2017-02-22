const os = /^win/.test(process.platform) ? 'windows' : 'mac';
const moment = require('moment');
const timestamp = moment().format('YYYYMMDDHHmmss');
const git = require('git-rev-sync');

const Selen = require('../lib/selen.js');
const selen = new Selen({
  browserName: 'chrome'
}, {
  mocha: {
    reporter: 'mochawesome',
    reporterOptions: {
      reportDir: `./mochawesome-reports/${os}/${selen.cap.browserName}/${git.branch()}/${git.long()}/${timestamp}/`,
      reportFilename: 'mochawesome.html',
      autoOpen: true
    }
  }
});

describe('Search and Get Title', function () {
  it('google', function*(driver, webdriver) {
    yield driver.get('http://www.google.com/ncr');
    yield driver.findElement(webdriver.By.name('q')).sendKeys('webdriver');
    yield driver.findElement(webdriver.By.name('btnG')).click();
    yield driver.wait(webdriver.until.titleIs('webdriver - Google Search'), 5000);
  });
});

selen.run();