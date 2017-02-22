# A Bootstrap for Selenium3.0. just only install this, you can E2E automation testing.

## Installation
```sh
yarn add selen
```
or
```sh
npm i selen -D
```

### Basic Usage

`selen.run()` is an simple API which work without Testing using `yield` and `generator` function, just only browser works.

index.js
```js
const Selen = require('selen');
const selen = new Selen({
  browserName: 'chrome'
});
selen.run(function* (driver, webdriver) {
  yield driver.get('http://www.google.com/ncr');
  yield driver.findElement(webdriver.By.name('q')).sendKeys('webdriver');
  yield driver.findElement(webdriver.By.name('btnG')).click();
  yield driver.wait(webdriver.until.titleIs('webdriver - Google Search'), 5000);
});
```
```sh
node index.js
```

## Usage for Testing with Mocha

Use `describe()` and `it()` with `yield` and `generator` function.
And run with `selen.run()` eventually, so you can get a awesome visualized report of [MOCHAWESOME](http://adamgruber.github.io/mochawesome/)!

index.js
```js
const Selen = require('selen');
const selen = new Selen({
  browserName: 'chrome'
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
```
```sh
node index.js
```

NOTE: Don't use `mocha` command.


## Some better API than native Webdriver API

### `driver.executeScript` and `driver.executeAsyncScript` are too unreadable and too difficult to write
The problem is that they are should to be passed as string like below.

```js
driver.executeScript('document.querySelector(".login-button").click();return [Arguments, are, available, at, here].join(" ");');
driver.executeAsyncScript('var callback = arguments[arguments.length = 1];document.querySelector(".login-button").click();setTimeout(function() {callback([Arguments, are, available, at, here].join(" "))}, 10000);')
```

#### `selen.executeScript`

```js
selen.executeScript(function(Arguments, are, available, at, here) {

  document.querySelector(".login-button").click();

  return [Arguments, are, available, at, here].join(' ');//Passed "Arguments are available at here;"
}, 'Arguments', 'are', 'available', 'at', 'here');
```

#### `selen.executeAsyncScript`

```js
selen.executeAsyncScript(function(Arguments, are, available, at, here) {
  var callback = arguments[arguments.length = 1];

  document.querySelector(".login-button").click();
 
  setTimeout(function() {
    callback([Arguments, are, available, at, here].join(" "))//Passed "Arguments are available at here;"
  }, 10000);
}, 'Arguments', 'are', 'available', 'at', 'here');
```

#### `selen.takeScreenshot`

```js
selen.takeScreenshot();// -> save screenshot in path based on the page url (replaced ? / # to _)
selen.takeScreenshot('./my_screenshot/hoge.png');// -> save screenshot in path based on the page url
```

- Supported for fullpage screenshot on almost browsers.
- Emulating fullpage screenshot with scrolling page.
- Saving file even if you don't specify path.


## Browser support on your local

On your local, `chrome` and `firefox` and `safari` are available even if not preparing special except for browser installing.
Support of `windows` and `ie11` and `edge` is preparing.

## Remote Testing with many browsers

### BrowserStack

Just add capabilities for BrowserStack

- See [capabilities](https://www.browserstack.com/automate/capabilities)
- Use [generator](https://www.browserstack.com/automate/node#setting-os-and-browser)

#### Testing page on local server
Just add `"browserstack.local": "true"` then browserStackLocal server start automatically.

```json
{
  "browserName": "iPhone",
  "platform": "MAC",
  "device": "iPhone 6",
  "browserstack.user": "****************",
  "browserstack.key": "********************",
  "browserstack.local": "true"//here
}
```

### SauceLabs

- See [capabilities](https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options)
- Use [generator](https://wiki.saucelabs.com/display/DOCS/Platform+Configurator/#/)

#### Testing page on local server

Download & use [Sauce Connect](https://wiki.saucelabs.com/display/DOCS/Sauce+Connect+Proxy) from Sauce Labs.


## Available for Options of Mocha and MOCHAWESOME

```js
const moment = require('moment');
const timestamp = moment().format('YYYYMMDDHHmmss');
const git = require('git-rev-sync');

const Selen = require('selen');
const selen = new Selen({
  browserName: 'chrome'
}, {
  mocha: {
    reporter: 'mochawesome',
    reporterOptions: {
      reportDir: `./mochawesome-reports/${git.branch()}/${git.long()}/${timestamp}/`,
      reportFilename: 'mochawesome.html',
      autoOpen: true
    }
  }
});
```

- See [Mocha's options](https://mochajs.org/)
- See [MOCHAWESOME's reportersOptions](https://github.com/adamgruber/mochawesome#options)

## Roadmap

###### v.0.9.0

- add custom takeScreenshot API

###### v.1.0.0

- support windows OS and browsers
- add function output browser logs

## Changed log

None.

## Dependencies
- [Node.js](https://nodejs.org/) (v7.5.0 is checked)
- [JRE](https://java.com/ja/download/) 1.8~
- [Selenium Webdriver for NodeJS](https://www.npmjs.com/package/selenium-webdriver)
- [Selenium Standalone](https://www.npmjs.com/package/selenium-standalone)
- [Mocha](https://mochajs.org/)
- [MOCHAWESOME](http://adamgruber.github.io/mochawesome/)


## Remote Selenium Services used by Capium.

They are awesome cloud testing services using real browsers and devices.

<a href="https://www.browserstack.com/"><img src="https://style-validator.io/img/browserstack-logo.svg" width="350" style="vertical-align: middle;"></a><br>
<br>
<a href="https://saucelabs.com/"><img src="https://saucelabs.com/content/images/logo@2x.png" width="350" style="vertical-align: middle;"></a><br>

