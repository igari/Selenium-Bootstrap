# A Bootstrap for Selenium3.0 to run E2E Testing more conveniently.

I recommend to use this with manager of Selenium Standalone Server,

e.g.)

- [webdriver-manager](https://www.npmjs.com/package/webdriver-manager)
- [selenium-standalone](https://www.npmjs.com/package/selenium-standalone)

## Features

### Generator & Yield are supported
- If you specify generator function , it is run like [co](https://www.npmjs.com/package/co) basically

### Better APIs than Native Webdriver
- selenium.executeScript
- selenium.executeAsyncScript
- etc is under implementing...(real click api, wait api)
- of course, native webdriver api is fully inherited

### if `fullAuto` options is set to `true`, you don't need setup other specials for Selenium except for this
Originally, below things is required to be worked Selenium.

When your script run...

- Required resources is downloaded & installed with  `Selenium Standalone`(from NPM Module) at only first time.
- Start and Stop `Selenium Standalone` automatically

## Installation
```sh
yarn add selenium-bootstrap -D
```
or
```sh
npm i selenium-bootstrap -D
```

## Usage

1. Install with `yarn add selenium-bootstrap` or `npm i selenium-bootstrap -D`
2. Write and run code like below
3. Selenium and Browser get started 

index.js
```js
const Selenium = require('selenium-bootstrap');
const selenium = new Selenium({
  browserName: 'chrome'
});
selenium.run(function* (driver, webdriver) {
  yield driver.get('http://www.google.com/ncr');
  yield driver.findElement(webdriver.By.name('q')).sendKeys('webdriver');
  yield driver.findElement(webdriver.By.name('btnG')).click();
  yield driver.wait(webdriver.until.titleIs('webdriver - Google Search'), 5000);
});
```
```sh
node index.js
```

`selenium.run()` is an simple API which launch Browser. Both of `generator function` and `normal function with prommise` are supported.(Below example is written `generator function`) 
And only argument is  `capabilities` which is able to be specified in the same way as `native Webdriver for NodeJS`.

- `driver` argument is newed built instance from `selenium-webdriver` module.
- `webdriver` argument is imported variable from `selenium-webdriver` module.


### More examples
- [Generator Example](https://github.com/igari/Selenium-Bootstrap/blob/master/examples/run.generator.js)
- [Promise Example](https://github.com/igari/Selenium-Bootstrap/blob/master/examples/run.promise.js)

In most cases, Generator is better than Promise chain.

## Custom Wrapper APIs (better then native Webdriver APIs) 

#### Problem of `driver.executeScript` and `driver.executeAsyncScript`
The problem is that they are should to be passed as string like below.

```js
driver.executeScript('document.querySelector(".login-button").click();return [Arguments, are, available, at, here].join(" ");');
driver.executeAsyncScript('var callback = arguments[arguments.length = 1];document.querySelector(".login-button").click();setTimeout(function() {callback([Arguments, are, available, at, here].join(" "))}, 10000);')
```

### `selenium.executeScript`

```js
selenium.executeScript(func[, Arg1, Arg2, ...]);
```
```js
selenium.executeScript(function(Arguments, are, available, at, here) {

  document.querySelector(".login-button").click();

  return [Arguments, are, available, at, here].join(' ');//Passed "Arguments are available at here;"
}, 'Arguments', 'are', 'available', 'at', 'here');
```

### `selenium.executeAsyncScript`

```js
selenium.executeAsyncScript(func[, Arg1, Arg2, ...]);
```
```js
selenium.executeAsyncScript(function(Arguments, are, available, at, here) {
  var callback = arguments[arguments.length = 1];

  document.querySelector(".login-button").click();
 
  setTimeout(function() {
    callback([Arguments, are, available, at, here].join(" "))//Passed "Arguments are available at here;"
  }, 10000);
}, 'Arguments', 'are', 'available', 'at', 'here');
```

### `selenium.takeScreenshot`

```js
selenium.takeScreenshot(path);
```
```js
selenium.takeScreenshot('./my_screenshot/hoge.png');// -> save screenshot into specified path
```

- `path` is optional. if not set, saved under cwd as filename which named based on url.
- Emulating **fullpage screenshot** with scrolling page for browsers which is not support fullpage screenshot(e.g. chrome).
- Unnecessary to write `fs.writeFile' or `fs.writeFileSync` by yourself to save screenshot image..

## options

### port
By default, it is referred to selenium standalone server

```js
const selenium = new Selenium({
  browserName: 'chrome'
}, {
  port: '9999',
});
```
- `port` is used selenium server(default port number is `4444`)

### fullAuto
```js
const selenium = new Selenium({
  browserName: 'chrome'
}, {
  fullAuto: true,
});
```

When your script run...

- Required resources is downloaded & installed with  `Selenium Standalone`(from NPM Module) at only first time.
- Start and Stop `Selenium Standalone` automatically
- `port` is available at the same time

### direct
```js
const selenium = new Selenium({
  browserName: 'chrome'
}, {
  direct: true
});
```
- if `direct` is set to `true`, run webdriver directly(not using selenium standalone server)


## Easy to use with Cloud Services for Remote or Multi Devices Testing

If you specify the service unique capability, then you can use these services.

They are awesome cloud testing services using real browsers and devices.

<a href="https://www.browserstack.com/"><img src="https://style-validator.io/img/browserstack-logo.svg" width="350" style="vertical-align: middle;"></a><br>
<br>
<a href="https://saucelabs.com/"><img src="https://saucelabs.com/content/images/logo@2x.png" width="350" style="vertical-align: middle;"></a><br>

## Change log

##### v0.3.0
- Support for Browsers on Windows
- Added `direct` Option for selecting whether to use webdriver for the browser directly(Default: false)
- Added `fullAuto` Option for running with downloading and installing full automatically

##### v0.2.0
- Added `port` Option used by selenium standalone server

##### v0.1.0
- Launch this module

## Dependencies
- [Node.js](https://nodejs.org/) (v7.5.0 is checked)
- [JRE](https://java.com/ja/download/) 1.8~
- [Selenium Webdriver for NodeJS](https://www.npmjs.com/package/selenium-webdriver)
- [Selenium Standalone](https://www.npmjs.com/package/selenium-standalone)
