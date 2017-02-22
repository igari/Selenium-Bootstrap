"use strict";

/******************************************
 * VARIABLES
 * *****************************************/

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const childProcess = require('child_process');
const packageJSON = require('../package.json');
const git = require('git-rev-sync');
const moment = require('moment');
const selenium = require('selenium-standalone');
const ssDefaultConfig = require('selenium-standalone/lib/default-config.js');
const webdriver = require("selenium-webdriver");
const SauceLabs = require("saucelabs");
const browserstack = require('browserstack-local');
const chrome = require("selenium-webdriver/chrome");
const FirefoxProfile = require('firefox-profile');
const Mocha = require('mocha');
const Test = Mocha.Test;
const Suite = Mocha.Suite;
const addContext = require('mochawesome/addContext');
const open = require('open');
const Capture = require("./capture.js");
require('./fast-selenium.js');
require('co-mocha')(Mocha);

/******************************************
 * CONSTRUCTOR
 * *****************************************/

function Selen(capabilities, options) {

  let defaultCapabilities = {
    browserName: 'chrome'
  };

  let defaultOptions = {
    mocha: {
      reporter: 'mochawesome',
      reporterOptions: {
        autoOpen: true
      }
    },
    screenshot: {
      path: './selen_shots'
    },
    errorshot: {
      path: './selen_error_shots'
    },
    log: {
      path: './log'
    }
  };

  this.cap = Object.assign(defaultCapabilities, capabilities);
  this.options = Object.assign(defaultOptions, options);
  this.ssConfig = Object.assign(ssDefaultConfig, {
    logger: function (message) {
      if (process.env.NODE_ENV === 'development') {
        console.log(message);
      }
    }
  });

  this.mocha = new Mocha(this.options.mocha);

  let mochaNativeAPIs = [describe, it, before, beforeEach, after, afterEach];
  for(let api of mochaNativeAPIs) {
    if(typeof api === 'function') {
      throw new Error("Don't use mocha command.");
    }
  }
  global.describe = this.describe.bind(this);
  global.it = this.it.bind(this);
  global.before = this.before.bind(this);
  global.beforeEach = this.beforeEach.bind(this);
  global.after = this.after.bind(this);
  global.afterEach = this.afterEach.bind(this);
}

/******************************************
 * PROTOTYPE
 * *****************************************/

Selen.prototype = {

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

      return this.start()
        .then(() => {
          return new Promise((resolve) => {
            this.runner = this.mocha.run(function (failures) {
              resolve(failures);
            })
            .on('test', function(test) {
              // console.log('Test started: '+test.title);
            })
            .on('test end', function(test) {
              // console.log('Test done: '+test.title);
            })
            .on('pass', function(test) {
              // console.log('Test passed');
              // console.log(test);
            })
            .on('fail', function(test, err) {
              // console.log('Test fail');
              // console.log(test);
              // console.log(err);
            })
            .on('end', function() {
              // console.log('All done');
            });
          })
        })
        .then((failures) => {
          return this.end().then(() => {
            process.on('exit', () => {
              process.exit(failures);  // exit with non-zero status if there were failures
            });
          })
        });
    }
  },

  /* [start]: Importing Mocha */

  describe: function (title, fnIncludedIt) {
    this.suite = Suite.create(this.mocha.suite, title);
    this.suite.timeout(60 * 60 * 1000);
    this.suite.retries(4);
    fnIncludedIt();
  },

  it: function (title, gen) {
    if (!this.isGenerator(gen)) {
      throw new Error('Specified function should be Generator.')
    }
    let it = new Test(title, (done) => {
      this.runGenerator(gen.bind(this.suite.ctx, this.driver, webdriver), done);
    });
    this.suite.addTest(it);
  },

  before: function (func) {
    this.suite.beforeAll(func);
  },

  after: function (func) {
    this.suite.afterAll(func);
  },

  beforeEach: function (func) {
    this.suite.beforeEach(func);
  },

  afterEach: function (func) {
    this.suite.afterEach(func);
  },

  /* [end]: Importing Mocha */

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
          this.takeErrorScreenshot()
            .then(() => {
              if(this.runner) {
                // This tells the test suite to bail as soon as possible.
                this.runner.suite.bail(true);
                // Simulate an uncaught exception.
                this.runner.uncaught(e);
              } else {
                next = generator.throw(e);
                handleGenerator.bind(this)(next);
              }
            });
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
   __________   _____  __
  / __/ __/ /  / __/ |/ /
 _\\ \\/ _// /__/ _//    / 
/___/___/____/___/_/|_/  
v${packageJSON.version}
    `);

    this.setParameters();
    this.bindEvents();

    this.dotsTimer = this.loadingDots();

    return Promise.all([
      this.startSauceConnect(),
      this.startBrowserStackLocal(),
      this.startSeleniumStandAlone()
    ])
      .then(clearInterval.bind(this, this.dotsTimer))
      .then(this.prepareDriver4Local.bind(this))
      .then(this.launchBrowser.bind(this));
  },

  loadingDots: function () {
    if (this.remoteTesingServer) {
      return;
    }
    process.stdout.write('Selenium Server is starting');
    let dots = '.';
    return setInterval(() => {
      process.stdout.write(dots);
      dots += '.'
    }, 1000);
  },

  prepareDriver4Local: function () {
    if (this.remoteTesingServer) {
      return Promise.resolve();
    }
    return Promise.all([
      this.setChromeDriver(),
      this.setGeckoDriver(),
      this.setFirefoxProfile()
    ]);
  },

  setParameters: function () {

    this.isSauceLabs = !!this.cap.username && !!this.cap.accessKey;
    this.isBrowserStack = !!this.cap['browserstack.user'] && !!this.cap['browserstack.key'];
    this.isLocal = !this.isBrowserStack && !this.isSauceLabs;

    if (this.isSauceLabs) {
      this.platform = 'saucelabs'
    }
    if (this.isBrowserStack) {
      this.platform = 'browserstack'
    }
    if (this.isLocal) {
      this.cap.os = /^win/.test(process.platform) ? 'windows' : 'mac';
      this.platform = 'local';
    }

    this.browserName = this.cap.browserName;
    this.isMobileOS = !!JSON.stringify(this.cap).match(/ios|android|iphone|ipad|ipod/gi);

    switch (this.platform) {
      case 'browserstack':
        let browserStackServer = 'http://hub-cloud.browserstack.com/wd/hub';
        this.remoteTesingServer = browserStackServer;
        break;
      case 'saucelabs':
        let sauceLabsServer = "http://" + this.cap.username + ":" + this.cap.accessKey + "@ondemand.saucelabs.com:80/wd/hub";
        this.remoteTesingServer = sauceLabsServer;
        break;
      default:
        break;
    }

    this.pathOfSeleniumStandalone = path.join(__dirname, '../../../', '/node_modules/selenium-standalone/.selenium');
    this.pathOfSeleniumStandalone4dev = path.join(__dirname, '../', '/node_modules/selenium-standalone/.selenium');
  },

  takeErrorScreenshot: function () {
    if (this.driver && this.suite && this.suite.ctx) {
      return this.takeScreenshot(null, true);
    } else {
      return Promise.resolve();
    }
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
          if (process.env.NODE_ENV === 'development') {
            console.log(message);
          }
        });
    });

    process.on('uncaughtException', (message) => {
      this.killAllProcesses()
        .then(() => {
          if (process.env.NODE_ENV === 'development') {
            console.log(message);
          }
        });
    });

    process.on('unhandledRejection', (message) => {
      this.killAllProcesses()
        .then(() => {
          if (process.env.NODE_ENV === 'development') {
            console.log(message);
          }
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
      .then(this.killLocalConnection.bind(this));
  },

  startSauceConnect: function () {

    if (!this.isSauceLabs) {
      return Promise.resolve();
    }

    // if(this.isIncludedLocalostInURL) {
    // 	this.cap.sauceConnect = true;
    // }

    if (!this.cap.sauceConnect) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {

      let sauceConnectPath = path.join(__dirname, '../', './util/sc-4.4.3-osx/bin/sc');
      this.sauceConnectProcess = childProcess.spawn(
        sauceConnectPath,
        ['-u', this.cap.username, '-k', this.cap.accessKey],
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

    if (!this.cap['browserstack.local']) {
      return Promise.resolve();
    }

    if (!this.cap['browserstack.key']) {
      throw new Error('To test on local server, specify browserstack.key');
    }

    this.bs_local = new browserstack.Local();
    this.bs_local_args = {
      'key': this.cap['browserstack.key'],
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

  setFirefoxProfile: function () {

    return Promise.resolve();

    if (this.browserName !== 'firefox') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let myProfile = new FirefoxProfile();

      myProfile.setPreference('plugin.state.flash', 0);
      myProfile.updatePreferences();

      myProfile.encoded((encodedProfile) => {
        this.cap['firefox_profile'] = encodedProfile;
        resolve();
      });
    });
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

  setChromeDriver: function () {

    if (this.browserName !== 'chrome') {
      return Promise.resolve();
    }

    return this.getPathOfSeleniumStandalone()
      .then((pathOfSeleniumStandalone) => {
        let chromeDriverPath = '';
        let newChromeDriverPath = '';

        if (pathOfSeleniumStandalone) {
          let chromeDriverPathDir = pathOfSeleniumStandalone + '/chromedriver';
          chromeDriverPath = `${chromeDriverPathDir}/${this.ssConfig.drivers.chrome.version}-${this.ssConfig.drivers.chrome.arch}-chromedriver`;
          newChromeDriverPath = `${chromeDriverPathDir}/chromedriver`;
          childProcess.execSync(`ln -sf ${chromeDriverPath} ${newChromeDriverPath}`);
          process.env.PATH = `${process.env.PATH}:${chromeDriverPath}`;

          try {
            childProcess.execSync(`ln -sf ${chromeDriverPath} ${newChromeDriverPath}`);
            process.env.PATH = `${process.env.PATH}:${chromeDriverPathDir}`;
            console.log('')
            console.log('----------------------------------------');
            console.log('chromedriver')
            console.log('----------------------------------------');
            console.log(`${newChromeDriverPath}\n>>> ${chromeDriverPath}`);

          } catch (error) {
            console.log(error);
          }
        }

        return newChromeDriverPath;
      });
  },

  setGeckoDriver: function () {

    if (this.browserName !== 'firefox') {
      return Promise.resolve();
    }

    return this.getPathOfSeleniumStandalone()
      .then((pathOfSeleniumStandalone) => {
        let geckoDriverPath = '';
        let newGeckoDriverPath = '';

        if (pathOfSeleniumStandalone) {
          let geckoDriverPathDir = pathOfSeleniumStandalone + '/geckodriver';
          geckoDriverPath = `${geckoDriverPathDir}/${this.ssConfig.drivers.firefox.version}-${this.ssConfig.drivers.firefox.arch}-geckodriver`;
          newGeckoDriverPath = `${geckoDriverPathDir}/geckodriver`;
          try {
            childProcess.execSync(`ln -sf ${geckoDriverPath} ${newGeckoDriverPath}`);
            process.env.PATH = `${process.env.PATH}:${geckoDriverPathDir}`;
            console.log('');
            console.log('----------------------------------------');
            console.log('geckodriver')
            console.log('----------------------------------------');
            console.log(`${newGeckoDriverPath}\n>>> ${geckoDriverPath}`);

          } catch (error) {
            console.log(error);
          }
        }
        return newGeckoDriverPath;
      });
  },


  startSeleniumStandAlone: function () {

    if (this.remoteTesingServer) {
      return Promise.resolve();
    } else {
      return new Promise((resolve) => {
        selenium.install(this.ssConfig, () => {
          selenium.start(this.ssConfig, (err, child) => {
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
    console.log(this.cap);

  },
  buildBrowser: function () {

    try {
      if (this.remoteTesingServer) {
        this.driver = new webdriver.Builder()
          .withCapabilities(this.cap)
          .usingServer(this.remoteTesingServer)
          .build();
      } else {
        this.driver = new webdriver.Builder()
          .withCapabilities(this.cap)
          .build();
      }
      return this.driver;
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
          return this.driver.manage().window().setSize(+this.cap.width || 1280, +this.cap.height || 768);
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
  getImageFileName: function (url) {
    this.imageFileName = `${url.split('://')[1].replace(/\/$/, '').replace(/\/|\?|#|=/g, '_')}.png`;
    return this.imageFileName;
  },
  takeScreenshot: function (imageFilePath, isError) {

    return Promise.resolve()
      .then(this.driver.getCurrentUrl.bind(this.driver))
      .then((currentUrl) => {
        let imageDir = isError ? this.options.errorshot.path : this.options.screenshot.path;
        imageFilePath = imageFilePath || path.join(imageDir, this.getImageFileName(currentUrl));
        let promises = [Promise.resolve()];
        let hasBasicAuthInURL = currentUrl.match(/https?:\/\/.+:.+@.+/);
        if (hasBasicAuthInURL && !this.isBrowserStack && /safari/.test(this.cap.browserName)) {
          promises.push(this.skipSafariWarning());
        }
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
          .then(this.handleScreenshot.bind(this, imageFilePath))
          .then(() => {
            let absoluteImageFilePath = path.join(process.cwd(), imageFilePath);
            if(this.runner) {
              addContext(this.suite.ctx, absoluteImageFilePath);
            }
            return absoluteImageFilePath;
          });
      });
  },

  handleScreenshot: function (imageFilePath) {
    const capture = new Capture(this);
    if (this.isMobileOS) {
      if (/android|safari/i.test(this.cap.browserName.toLowerCase())) {
        return capture.takeFullScreenshot(imageFilePath);
      } else {
        return capture.takeScreenshot(imageFilePath);
      }
    } else {
      if (/chrome|edge|ie|firefox/i.test(this.cap.browserName.toLowerCase())) {
        return capture.takeFullScreenshot(imageFilePath);
      } else {
        return capture.takeScreenshot(imageFilePath);
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

  //TODO: implement
  getBrowserLogs: function () {
    if (this.cap.browserName !== 'chrome') {
      return Promise.resolve();
    }
    let log = '';

    return this.driver.manage().logs().getAvailableLogTypes()
      .then((typeArray) => {
        let promises = [];

        typeArray.forEach((type) => {
          promises.push(this.writeBrowserLogs(type, log));
        });

        return Promise.all(promises)
      });
  },

  //TODO: implement
  writeBrowserLogs: function (type, log) {
    return this.driver.manage().logs().get(type).then((entries) => {
      entries.forEach((entry) => {
        log += `[${entry.level.name}] ${entry.message}\n`;
      });
    })
      .then(() => {
        return new Promise((resolve, reject) => {
          let logPath = `${this.options.log.path}/chrome.log.${type}.txt`;
          fs.writeFile(logPath, log, {}, (err) => {
            if (err) {
              reject(err)
            }
            console.log(`Completed to write ${logPath}`);
            log = '';
            resolve();
          });
        });
      });
  },

  isGenerator: function (gen) {
    let GeneratorFunction = (function*() {}).constructor;
    return gen instanceof GeneratorFunction;
  },

  sendResult2SauceLabs: function () {
    if (this.isSauceLabs) {
      return new Promise((resolve) => {
        let sauceLabs = new SauceLabs({
          username: this.cap.username,
          password: this.cap.accessKey
        });
        return sauceLabs.updateJob(
          this.driver.sessionID,
          {
            name: this.cap.name,
            passed: true//TODO: fix
          },
          resolve
        );
      })
    } else {
      return Promise.resolve();
    }
  },

  end: function () {
    return this.killAllProcesses()
      .then(this.sendResult2SauceLabs.bind(this))
      .then(() => {
        console.log('--------------------------------------------------');
        console.log('Completed process!');
      });
  }
};

module.exports = Selen;