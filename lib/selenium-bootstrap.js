"use strict";

/******************************************
 * VARIABLES
 * *****************************************/

const path = require("path");
const fs = require("fs");
const childProcess = require('child_process');
const packageJSON = require('../package.json');
const selenium = require('selenium-standalone');
const ssDefaultConfig = require('selenium-standalone/lib/default-config.js');
const webdriver = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const Capture = require("./capture.js");
const rimraf = require('rimraf');
const out = fs.openSync('./selenium-bootstrap.log', 'a');
const err = fs.openSync('./selenium-bootstrap.log', 'a');
require('./fast-selenium.js');

/******************************************
 * CONSTRUCTOR
 * *****************************************/

function Selenium(capabilities, options) {

  let defaultCapabilities = {
    browserName: 'chrome'
  };

  let defaultOptions = {
    sss: false,
    port: '4444'
  };

  this.capabilities = Object.assign(defaultCapabilities, capabilities);
  this.options = Object.assign(defaultOptions, options);
  this.ssCommonOpts = Object.assign(
    ssDefaultConfig,
    {
      seleniumArgs: ['-port', this.options.port]
    }
  );
  this.ssInstallOpts = {
    version: '3.0.0-beta4',
    logger: function (message) {
      if (process.env.NODE_ENV === 'development') {
        console.log(message);
      }
    },
  };
  this.ssStartOpts = {
    spawnOptions: {
      detached: true,
      stdio: [ 'ignore', out, err ]
    }
  };
}

/******************************************
 * PROTOTYPE
 * *****************************************/

Selenium.prototype = {

  run: function (fn) {

    if (typeof fn === 'function') {

      if (this.isGenerator(fn)) {

        return this.start()
          .then(() => {
            return new Promise((done) => {
              fn = fn.bind(this, this.driver, webdriver);
              return this.runGenerator(fn, done)
            })
          })
          .then(this.end.bind(this));

      } else {

        return this.start()
          .then(() => {
            return fn(this.driver, webdriver);
          })
          .then(this.end.bind(this));

      }

    } else {

      throw new Error('function is required.')
    }
  },

  runGenerator: function (gen, done) {

    const generator = gen();

    var next = generator.next();

    handleGenerator.bind(this)(next);

    function loopGenerator(promise) {
      promise
        .then((result) => {
          next = generator.next(result);
          handleGenerator.bind(this)(next);
        })
        .catch((e) => {
          next = generator.throw(e);
          handleGenerator.bind(this)(next);
        });
    }

    function handleGenerator(next) {
      if (!next.done) {
        let promise = next.value;
        loopGenerator.bind(this)(promise);
      } else {
        if (typeof done === 'function') {
          done();
        }
      }
    }

  },


  start: function () {

    this.isProcessExist = true;

    console.log(`
   _____      __           _                    ____              __       __                 
  / ___/___  / /__  ____  (_)_  ______ ___     / __ )____  ____  / /______/ /__________ _____ 
  \\__ \\/ _ \\/ / _ \\/ __ \\/ / / / / __ \`__ \\   / __  / __ \\/ __ \\/ __/ ___/ __/ ___/ __ \`/ __ \\
 ___/ /  __/ /  __/ / / / / /_/ / / / / / /  / /_/ / /_/ / /_/ / /_(__  ) /_/ /  / /_/ / /_/ /
/____/\\___/_/\\___/_/ /_/_/\\__,_/_/ /_/ /_/  /_____/\\____/\\____/\\__/____/\\__/_/   \\__,_/ .___/ 
                                                                                     /_/
v${packageJSON.version}
    `);

    this.setParameters();
    this.bindEvents();

    return Promise.all([
      this.startSauceConnect(),
      this.startBrowserStackLocal(),
      this.startSeleniumStandAlone()
    ])
      .then(clearInterval.bind(this, this.dotsTimer))
      .then(this.launchBrowser.bind(this));
  },

  loadingDots: function () {
    if (this.remoteTesingServer) {
      return;
    }
    process.stdout.write(`Selenium Server is starting on http://localhost:${this.options.port}/wd/hub/`);
    let dots = '.';
    return setInterval(() => {
      process.stdout.write(dots);
      dots += '.'
    }, 1000);
  },

  setParameters: function () {

    this.isSauceLabs = !!this.capabilities.username && !!this.capabilities.accessKey;
    this.isBrowserStack = !!this.capabilities['browserstack.user'] && !!this.capabilities['browserstack.key'];
    this.isLocal = !this.isBrowserStack && !this.isSauceLabs;

    if (this.isSauceLabs) {
      this.platform = 'saucelabs'
    }
    if (this.isBrowserStack) {
      this.platform = 'browserstack'
    }
    if (this.isLocal) {
      this.capabilities.os = /^win/.test(process.platform) ? 'windows' : 'mac';
      this.platform = 'local';
    }

    this.browserName = this.capabilities.browserName;
    this.isMobileOS = !!JSON.stringify(this.capabilities).match(/ios|android|iphone|ipad|ipod/gi);

    switch (this.platform) {
      case 'browserstack':
        let browserStackServer = 'http://hub-cloud.browserstack.com/wd/hub';
        this.remoteTesingServer = browserStackServer;
        break;
      case 'saucelabs':
        let sauceLabsServer = "http://" + this.capabilities.username + ":" + this.capabilities.accessKey + "@ondemand.saucelabs.com:80/wd/hub";
        this.remoteTesingServer = sauceLabsServer;
        break;
      default:
        break;
    }

    this.pathOfSeleniumStandalone = path.join(__dirname, '../../../', '/node_modules/selenium-standalone/.selenium');
    this.pathOfSeleniumStandalone4dev = path.join(__dirname, '../', '/node_modules/selenium-standalone/.selenium');
  },

  bindEvents: function () {

    process.on('SIGINT', () => {
      this.killAllProcesses()
        .then(() => {
          console.log('');
          console.log('process is canceled!');
          console.log('');
          process.exit();
        });
    });

    process.on('error', (message) => {
      this.killAllProcesses()
        .then(() => {
          console.log(message);
        });
    });

    process.on('uncaughtException', (message) => {
      this.killAllProcesses()
        .then(() => {
          console.log(message);
        });
    });

    process.on('unhandledRejection', (message) => {
      this.killAllProcesses()
        .then(() => {
          console.log(message);
        });
    });
  },

  killBrowser: function () {
    if (this.driver && this.driver.sessionID) {
      return this.driver.quit();
    } else {
      return Promise.resolve();
    }
  },

  killSeleniumStandalone: function () {
    if (this.childProcessOfSeleniumStandAlone) {
      this.childProcessOfSeleniumStandAlone.kill();
    }
  },

  killBrowserStackLocal: function () {
    if (this.bs_local) {
      return new Promise((resolve) => {
        this.bs_local.stop(() => {
          console.log('');
          console.log("****Closed BrowserStackLocal Process****");
          console.log('');
          resolve();
        });
      });
    } else {
      return Promise.resolve();
    }
  },

  killSauceConnect: function () {
    if (this.sauceConnectProcess) {
      return new Promise((resolve) => {
        this.sauceConnectProcess.on('close', (code) => {
          console.log('');
          console.log("****Closed Sauce Connect process****");
          console.log('');
          resolve();
        });
        this.sauceConnectProcess.kill();
      })
    } else {
      return Promise.resolve();
    }
  },

  killLocalConnection: function () {
    if (this.sauceConnectProcess) {
      return this.killSauceConnect();
    }
    if (this.bs_local) {
      return this.killBrowserStackLocal();
    }
  },

  killAllProcesses: function () {

    if (!this.isProcessExist) {
      return Promise.resolve();
    }
    this.isProcessExist = false;

    return this.killBrowser()
      .then(this.killSeleniumStandalone.bind(this))
      .then(this.killLocalConnection.bind(this))
      .then(() => {
        // if(this.options.sss) {
        //   return this.getPathOfSeleniumStandalone()
        //     .then((pathOfSeleniumStandalone) => {
        //       return new Promise(function (resolve) {
        //         rimraf(pathOfSeleniumStandalone, resolve);
        //       });
        //     })
        // }
      });
  },

  startSauceConnect: function () {

    if (!this.isSauceLabs) {
      return Promise.resolve();
    }

    // if(this.isIncludedLocalostInURL) {
    // 	this.capabilities.sauceConnect = true;
    // }

    if (!this.capabilities.sauceConnect) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {

      let sauceConnectPath = path.join(__dirname, '../', './util/sc-4.4.3-osx/bin/sc');
      this.sauceConnectProcess = childProcess.spawn(
        sauceConnectPath,
        ['-u', this.capabilities.username, '-k', this.capabilities.accessKey],
        { detached: true },
        (err, child) => {
          if (err) {
            throw err;
          }
          child.kill();
        }
      );

      console.log('');
      console.log("**** Started Sauce Connect Process ****");
      console.log('');

      this.sauceConnectProcess.stdout.on('data', (data) => {
        console.log('stdout: ' + data.toString());
        if (data.toString().indexOf('Sauce Connect is up, you may start your tests.') > -1) {
          resolve();
        }
      });
    });
  },

  startBrowserStackLocal: function () {

    if (!this.isBrowserStack) {
      return Promise.resolve();
    }

    if (!this.capabilities['browserstack.local']) {
      return Promise.resolve();
    }

    if (!this.capabilities['browserstack.key']) {
      throw new Error('To test on local server, specify browserstack.key');
    }

    this.bs_local = new browserstack.Local();
    this.bs_local_args = {
      'key': this.capabilities['browserstack.key'],
      'force': 'true',
      'parallelRuns': 2,
      'onlyAutomate': true,
      'logFile': './browserStackLocal.txt'
    };

    return new Promise((resolve) => {
      this.bs_local.start(this.bs_local_args, () => {
        console.log('');
        console.log("**** Started BrowserStackLocal Process ****");
        console.log('');
        resolve();
      });
    })

  },

  getPathOfSeleniumStandalone: function () {
    return new Promise((resolve) => {

      fs.stat(this.pathOfSeleniumStandalone4dev, (err, data) => {
        if (err || !data.isDirectory()) {
          fs.stat(this.pathOfSeleniumStandalone, (err, data) => {
            if (err || !data.isDirectory()) {
              resolve('');
            } else {
              resolve(this.pathOfSeleniumStandalone)
            }
          });
        } else {
          resolve(this.pathOfSeleniumStandalone4dev);
        }
      });
    });
  },

  startSeleniumStandAlone: function () {

    if (this.remoteTesingServer || !this.options.sss) {
      return Promise.resolve();
    } else {
      return new Promise((resolve) => {
        this.dotsTimer = this.loadingDots();
        selenium.install(Object.assign(this.ssCommonOpts, this.ssInstallOpts), () => {
          selenium.start(Object.assign(this.ssCommonOpts, this.ssStartOpts), (err, child) => {
            if (err) throw err;
            this.childProcessOfSeleniumStandAlone = child;
            resolve(child);
          });
        });
      })
    }
  },

  launchBrowser: function () {
    this.showCapability();
    return this.buildBrowser()
      .then(this.initBrowser.bind(this));
  },

  showCapability: function () {

    console.log('');
    console.log('----------------------------------------');
    console.log('capability');
    console.log('----------------------------------------');
    console.log(this.capabilities);

  },
  buildBrowser: function () {

    try {

      if (this.remoteTesingServer) {

        this.driver = new webdriver.Builder()
          .withCapabilities(this.capabilities)
          .usingServer(this.remoteTesingServer)
          .build();

      } else if(this.options.sss) {

        this.driver = new webdriver.Builder()
          .withCapabilities(this.capabilities)
          .usingServer(`http://localhost:${this.options.port}/wd/hub/`)
          .build();

      } else {

        this.driver = new webdriver.Builder()
          .withCapabilities(this.capabilities)
          .build();
      }

      return typeof this.driver.then === 'function' ? this.driver : Promise.resolve();

    } catch (error) {

      return this.killAllProcesses()
        .then(() => {
          console.error(error);
        });
    }
  },

  initBrowser: function () {

    let timeouts = this.driver.manage().timeouts();
    return Promise.resolve()
      .then(() => {
        if (this.isSauceLabs && this.isMobileOS) {
          this.driver.context('NATIVE_APP');
        }
      })
      .then(timeouts.implicitlyWait.bind(timeouts, 60/*m*/ * 60/*s*/ * 1000/*ms*/))
      .then(timeouts.setScriptTimeout.bind(timeouts, 60/*m*/ * 60/*s*/ * 1000/*ms*/))
      .then(timeouts.pageLoadTimeout.bind(timeouts, 60/*m*/ * 60/*s*/ * 1000/*ms*/))
      .then(() => {
        //this.driver.manage().window().maximize();
        //this.driver.manage().window().setPosition(x, y);
        if (!this.isMobileOS) {
          return this.driver.manage().window().setSize(+this.capabilities.width || 1280, +this.capabilities.height || 768);
        }
      })
      .then(() => {
        return this.driver.getSession().then((session) => {
          this.driver.sessionID = session.id_;
          return session;
        });
      });

  },
  func2str: function (func) {
    return func.toString();
  },
  executeScript: function (func) {
    let argsArray = [];
    let originalArgs = Array.prototype.slice.call(arguments);

    originalArgs = originalArgs.slice(1);

    for (let arg of originalArgs) {
      let _arg = typeof arg === 'string' ? '\"' + arg + '\"' : arg;
      argsArray.push(_arg);
    }

    let argsString = argsArray.join(',');

    return this.driver.executeScript('return (' + this.func2str(func) + '(' + argsString + '));');
  },
  executeAsyncScript: function (func) {
    let argsString = '';
    let argsArray = [];
    let callbackString = 'arguments[arguments.length-1]';
    let originalArgs = Array.prototype.slice.call(arguments);

    originalArgs = originalArgs.slice(1);

    for (let arg of originalArgs) {
      let _arg = typeof arg === 'string' ? '\"' + arg + '\"' : arg;
      argsArray.push(_arg)
    }

    if (argsArray.length > 0) {
      argsString = argsArray.join(',') + ',' + callbackString;
    } else {
      argsString = callbackString;
    }

    return this.driver.executeAsyncScript('(' + this.func2str(func) + '(' + argsString + '));');
  },

  waitForUnbindingBeforeLoad: function () {
    var iaPageLoaded = document.readyState === 'complete' &&
      performance.timing.loadEventEnd &&
      performance.timing.loadEventEnd > 0;

    if (iaPageLoaded) {
      var jQueryScript = document.querySelector('script[src*="jquery"]');
      if (jQueryScript && jQueryScript.length > 0) {
        var __jquery__ = jQuery || $;
        if (__jquery__) {
          try {
            var beforeunload = __jquery__._data(__jquery__(window)[0], 'events').beforeunload;
            return beforeunload && beforeunload instanceof Array && beforeunload.length > 0;
          } catch (e) {
            return false;
          }
        } else {
          return false;
        }
      } else {
        return true;
      }
    } else {
      return false;
    }
  },
  unbindBeforeUnload: function () {
    window.onbeforeunload = null;
    try {
      if (jQuery || $) {
        $(window).off('beforeunload');
      }
    } catch (e) {
    }
  },
  takeScreenshot: function (imageFilePath, isError) {

    return Promise.resolve()
      .then(this.driver.getCurrentUrl.bind(this.driver))
      .then((currentUrl) => {
        let promises = [Promise.resolve()];
        let hasBasicAuthInURL = currentUrl.match(/https?:\/\/.+:.+@.+/);
        if (hasBasicAuthInURL && !this.isBrowserStack && /safari/.test(this.capabilities.browserName)) {
          promises.push(this.skipSafariWarning());
        }
        imageFilePath = imageFilePath || `${currentUrl.split('://')[1].replace(/\/$/, '').replace(/\/|#|\?|&|=|\*/g, '_')}.png`
        let absoluteImageFilePath = path.join(process.cwd(), imageFilePath);
        return Promise.all(promises)
          .then(() => {
            let timeout = 60/*s*/ * 1000/*ms*/;
            let timeoutMsg = 'unbinding could not be completed.';
            return this.driver.wait(this.executeScript(this.waitForUnbindingBeforeLoad), timeout, timeoutMsg)
              .then(() => {
                console.log('[wait for unbinding before load]', 'done');
              });
          })
          .then(() => {
            return this.executeScript(this.unbindBeforeUnload)
              .then(() => {
                console.log('[unbind before unload]', 'done');
              });
          })
          .then(this.handleScreenshot.bind(this, absoluteImageFilePath))
          .then(() => {
            return absoluteImageFilePath;
          });
      });
  },

  handleScreenshot: function (absoluteImageFilePath) {
    const capture = new Capture(this);
    if (this.isMobileOS) {
      if (/android|safari/i.test(this.capabilities.browserName.toLowerCase())) {
        return capture.takeFullScreenshot(absoluteImageFilePath);
      } else {
        return capture.takeScreenshot(absoluteImageFilePath);
      }
    } else {
      if (/chrome|edge|firefox/i.test(this.capabilities.browserName.toLowerCase())) {
        return capture.takeFullScreenshot(absoluteImageFilePath);
      } else {
        return capture.takeScreenshot(absoluteImageFilePath);
      }
    }
  },

  skipSafariWarning: function () {
    return this.driver.wait(webdriver.until.elementLocated(webdriver.By.id('ignoreWarning')), 10/*s*/ * 1000/*ms*/, 'The button could not found.')
      .then((button) => {
        return button.click();
      })
      .then(this.driver.sleep.bind(this.driver, 1/*s*/ * 1000/*ms*/))
      .then(console.log.bind(null, 'Clicked a button to ignore'));
  },

  isGenerator: function (gen) {
    let GeneratorFunction = (function*() {}).constructor;
    return gen instanceof GeneratorFunction;
  },

  end: function () {
    return this.killAllProcesses()
      .then(() => {
        console.log('--------------------------------------------------');
        console.log('Completed process!');
      });
  }
};

module.exports = Selenium;