# A Bootstrap for Selenium3.0. just only install this, you can E2E automation testing.

## Installation
```sh
yarn add selenium-bootstrap
```
or
```sh
npm i selenium-bootstrap -D
```

## Usage

`selenium.run()` is an simple API which launch Browser. Both of `generator function` and `normal function with prommise` are supported.(Below example is written `generator function`) 
And only argument is  `capabilities` which is able to be specified in the same way as `native Webdriver for NodeJS`.

- `driver` argument is newed built instance from `selenium-webdriver` module.
- `webdriver` argument is imported variable from `selenium-webdriver` module.

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

### More examples
- [Generator Example](https://github.com/igari/Selenium-Bootstrap/blob/master/examples/run.generator.js)
- [Promise Example](https://github.com/igari/Selenium-Bootstrap/blob/master/examples/run.promise.js)

In most cases, Generator is better than Promise chain.

## Features

### Basically, you don't need setup other specials for Selenium except for this
Originally, below things is required to be worked Selenium.

- Download & Install `Selenium Standalone`(from NPM Module)
- When your script run, `Selenium Standalone` start automatically
- Download & Set PATH for driver binary of each browsers(except for safari10~)
- Launch browser and execute WebDriver codes.  

### Fully Inherit native Webdriver for NodeJS
So writable native Webdriver for NodeJS in function `selenium.run`

### Custom Wrapper APIs (better then native Webdriver APIs) 

##### Problem of `driver.executeScript` and `driver.executeAsyncScript`
The problem is that they are should to be passed as string like below.

```js
driver.executeScript('document.querySelector(".login-button").click();return [Arguments, are, available, at, here].join(" ");');
driver.executeAsyncScript('var callback = arguments[arguments.length = 1];document.querySelector(".login-button").click();setTimeout(function() {callback([Arguments, are, available, at, here].join(" "))}, 10000);')
```

#### `selenium.executeScript`

```js
selenium.executeScript(func[, Arg1, Arg2, ...]);
```
```js
selenium.executeScript(function(Arguments, are, available, at, here) {

  document.querySelector(".login-button").click();

  return [Arguments, are, available, at, here].join(' ');//Passed "Arguments are available at here;"
}, 'Arguments', 'are', 'available', 'at', 'here');
```

#### `selenium.executeAsyncScript`

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

#### `selenium.takeScreenshot`

```js
selenium.takeScreenshot(path);
```
```js
selenium.takeScreenshot('./my_screenshot/hoge.png');// -> save screenshot into specified path
```

- Emulating **fullpage screenshot** with scrolling page for browsers which is not support fullpage screenshot(e.g. chrome).
- Unnecessary to write `fs.writeFile' or `fs.writeFileSync` by yourself to save screenshot image..


## Let's use with Cloud Services for Remote or Multi Devices Testing

In the same way as native Webdriver, if you specify the service unique capability, then you can use these services.

They are awesome cloud testing services using real browsers and devices.

<a href="https://www.browserstack.com/"><img src="https://style-validator.io/img/browserstack-logo.svg" width="350" style="vertical-align: middle;"></a><br>
<br>
<a href="https://saucelabs.com/"><img src="https://saucelabs.com/content/images/logo@2x.png" width="350" style="vertical-align: middle;"></a><br>


## Dependencies
- [Node.js](https://nodejs.org/) (v7.5.0 is checked)
- [JRE](https://java.com/ja/download/) 1.8~
- [Selenium Webdriver for NodeJS](https://www.npmjs.com/package/selenium-webdriver)
- [Selenium Standalone](https://www.npmjs.com/package/selenium-standalone)
