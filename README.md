# Just only Install this, then Selenium3.0 works. So E2E Testing can get started so easily!

## Installation
```sh
yarn add selen
```
or
```sh
npm i selen -D
```

## Usage

This is a minimal code! Try out `firefox` and `safari` also if you have.
`selen.run` is an API which work without Testing using `yield` and `generator` function, just only work.

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

- Launch Selenium Standalone
- Launch Browser(No necessary to set up Drivers!)
- Execute WebDriver Code (Write with `yield` with `generator` function)
- Kill all of process related to theirs
- Done!

### Testing with [Mocha](https://mochajs.org/)

Use `selen.describe` and `selen.it` with `yield` and `generator` function.
So you can get a report from Mocha

index.js
```js
selen.describe('Get Title of each page', function () {
  selen.it('google', function*(driver, webdriver) {
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
[NOTE] Don't use `mocha` command.


## Some better API than native Webdriver API

### `driver.executeScript` and `driver.executeAsyncScript` are too unreadable and too difficult to write
because they are should to be passed as string like below.

```js
driver.executeScript('var allElements = document.querySelector("*"); for(var i = 0, len = allElements.length; i < len; i++) { allElements[i].hidden = true; } return "any value to want to pass";')
```

#### `this.executeScript`

```js
this.executeScript(function(arg1, arg2, arg3, arg4, arg5) {
  var allElements = document.querySelector("*");
  for(var i = 0, len = allElements.length; i < len; i++) {
    allElements[i].hidden = true;
  }
  return 'any value to want to pass';
});
```

#### `this.executeAsyncScript`

```js
this.executeAsyncScript(function() {
  var callback = arguments[arguments.length = 1];
  setTimeout(function() {
    callback('any value to want to pass')
  }, 10000);
});
```

#### `this.saveFullScreenshot`

Under Implementing.


## Remote Testing with many browsers

### BrowserStack
```js
const Selen = require('selen');
const selen = new Selen({
  'browserName': 'iPhone',
  'platform' : 'MAC',
  'device' : 'iPhone 6S',
  'browserstack.user': '***************',
  'browserstack.key': '*****************'
});
```

- See [capabilities](https://www.browserstack.com/automate/capabilities)
- Use [generator](https://www.browserstack.com/automate/node#setting-os-and-browser)

#### Testing page on local server
Just add `"browserstack.local": "true"`

```json
{
  "browserName": "iPhone",
  "platform": "MAC",
  "device": "iPhone 6",
  "browserstack.user": "****************",
  "browserstack.key": "********************",
  "browserstack.local": "true"
}
```

### SauceLabs
```js
const Selen = require('selen');
const selen = new Selen({
  'browserName': 'chrome',
  'os': 'android',
  'username': '**********',
  'accessKey': '*************************'
});
```

- See [capabilities](https://wiki.saucelabs.com/display/DOCS/Test+Configuration+Options)
- Use [generator](https://wiki.saucelabs.com/display/DOCS/Platform+Configurator/#/)

#### Testing page on local server

Download & use [Sauce Connect](https://wiki.saucelabs.com/display/DOCS/Sauce+Connect+Proxy) from Sauce Labs.


## Roadmap

###### v.0.9.0

- add saveFullScreenshot API
- add function output browser logs

## Changed log

None.

## Dependencies
- [Node.js](https://nodejs.org/) (v7.5.0 is checked)
- [JRE](https://java.com/ja/download/) 1.8~
- [Selenium Webdriver for NodeJS](https://www.npmjs.com/package/selenium-webdriver)
- [Selenium Standalone](https://www.npmjs.com/package/selenium-standalone)
- [Mocha](https://mochajs.org/)
- [mochawesome](http://adamgruber.github.io/mochawesome/)


## Remote Selenium Services used by Capium.

They are awesome cloud testing services using real browsers and devices.

<a href="https://www.browserstack.com/"><img src="https://style-validator.io/img/browserstack-logo.svg" width="350" style="vertical-align: middle;"></a><br>
<br>
<a href="https://saucelabs.com/"><img src="https://saucelabs.com/content/images/logo@2x.png" width="350" style="vertical-align: middle;"></a><br>


