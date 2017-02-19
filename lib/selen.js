"use strict";

const os = /^win/.test(process.platform) ? 'windows' : 'mac';
const co = require("co");
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const childProcess = require('child_process');
const packageJSON = require('../package.json');
const git = require('git-rev');
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
const open = require('open');
const Capture = require("./capture.js");

require('./fast-selenium.js');

function Selen(capabilities, options) {

  this.cap = Object.assign({
    browserName: 'chrome'
  }, capabilities);

  this.options = Object.assign({}, options);

  this.ssConfig = Object.assign(ssDefaultConfig, {
    // logger: function(message) {
    // 	console.log(message);
    // }
  });

  this.mocha = new Mocha({
    reporter: 'mochawesome'
  });

}

Selen.prototype = {

  isGeneratorFunction: function (gen) {
    let GeneratorFunction = (function*(){}).constructor;
    return gen instanceof GeneratorFunction;
  },

  run: function (gen) {

    if(typeof gen === 'function') {
      if(!this.isGeneratorFunction(gen)) {
        throw new Error('Specified function should be Generator.')
      }
      return this.start()
        .then(function () {
          return new Promise(function (done) {
            gen = gen.bind(this, this.driver, webdriver);
            return this.runGen(gen, done)
          }.bind(this))
        }.bind(this))
        .then(this.end.bind(this));
    } else {

      this.mocha.run(function(failures){
        process.on('exit', function () {
          open(path.join(process.cwd(), './mochawesome-reports/mochawesome.html'));
          process.exit(failures);  // exit with non-zero status if there were failures
        });
      });
    }
  },

  describe: function (title, fnIncludedIt) {

    let selen = this;

    this.suite = Suite.create(this.mocha.suite, title);
    this.suite.timeout(60 * 60 * 1000);
    this.suite.beforeAll(selen.start.bind(selen));
    this.suite.afterAll(selen.end.bind(selen));
    fnIncludedIt();

    //TODO: enable to work with node
    // describe(title, function () {
    //   this.timeout(60 * 60 * 1000);
    //   before(selen.start.bind(selen));
    //   fnIncludedIt();
    //   after(selen.end.bind(selen));
    // });
  },

  it: function (title, gen) {
    if(!this.isGeneratorFunction(gen)) {
      throw new Error('Specified function should be Generator.')
    }
    this.suite.addTest(new Test(title, (done) => {
      this.runGen(gen.bind(this, this.driver, webdriver), done);
    }));

    // it(title, function (done) {
    //   this.runGen(gen.bind(this, this.driver, webdriver), done);
    // }.bind(this))
  },

  runGen: function (gen, done) {

    const generator = gen();

    let next = generator.next();   // ここで最初のyieldまで実行される

    return onEnd(next);

    function loop(promise) {
      promise.then((result) => {
        let next = generator.next(result);   // nextの引数はyield式の評価結果として返される。そして次のyieldまで実行
        onEnd(next);
      }).catch((e) => {
        let next = generator.throw(e);
        onEnd(next);
      });
    }

    function onEnd(next) {
      if (!next.done) {
        let promise = next.value;
        loop(promise);
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
 _\ \/ _// /__/ _//    / 
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
    return setInterval(function () {
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
    this.isMobileOS = /android|android_emulator|ios|ios_emulator/.test(this.cap.os);

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

  bindEvents: function () {
    process.on('SIGINT', function () {
      this.killAllProcesses()
        .then(function () {
          console.log('');
          console.log('process is canceled!');
          console.log('');
          process.exit();
        });
    }.bind(this));
    process.on('error', function (message) {
      this.killAllProcesses().then(function () {
        console.log(message);
        // process.exit(1);
      });
    }.bind(this));
    process.on('uncaughtException', (message) => {
      this.killAllProcesses().then(function () {
        console.log(message);
        // process.exit(1);
      });
    });
    process.on('unhandledRejection', function (message) {
      this.killAllProcesses().then(function () {
        console.log(message);
        // process.exit(1);
      });
    }.bind(this));
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
      return new Promise(function (resolve) {
        this.bs_local.stop(function () {
          console.log('');
          console.log("****Closed BrowserStackLocal Process****");
          console.log('');
          resolve();
        });
      }.bind(this));
    } else {
      return Promise.resolve();
    }
  },

  killSauceConnect: function () {
    if (this.sauceConnectProcess) {
      return new Promise(function (resolve) {
        this.sauceConnectProcess.on('close', function (code) {
          console.log('');
          console.log("****Closed Sauce Connect process****");
          console.log('');
          resolve();
        });
        this.sauceConnectProcess.kill();
      }.bind(this))
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

    return new Promise(function (resolve) {

      let sauceConnectPath = path.join(__dirname, '../', './util/sc-4.4.3-osx/bin/sc');
      this.sauceConnectProcess = childProcess.spawn(
        sauceConnectPath,
        [`-u`, this.cap.username, `-k`, this.cap.accessKey],
        {
          detached: true
        },
        function (err, child) {
          if (err) {
            throw err;
          }
          child.kill();
        }.bind(this)
      );

      console.log('');
      console.log("**** Started Sauce Connect Process ****");
      console.log('');

      this.sauceConnectProcess.stdout.on('data', function (data) {
        console.log('stdout: ' + data.toString());
        if (data.toString().indexOf('Sauce Connect is up, you may start your tests.') > -1) {
          resolve();
        }
      });
    }.bind(this));

    // return new Promise(function (resolve) {
    // 	sauceConnectLauncher({
    // 		// Sauce Labs username.  You can also pass this through the
    // 		// SAUCE_USERNAME environment variable
    // 		username: this.cap['username'],
    //
    // 		// Sauce Labs access key.  You can also pass this through the
    // 		// SAUCE_ACCESS_KEY environment variable
    // 		accessKey: this.cap['accessKey'],
    //
    // 		// Log output from the `sc` process to stdout?
    // 		verbose: true,
    //
    // 		// A function to optionally write sauce-connect-launcher log messages.
    // 		// e.g. `console.log`.  (optional)
    // 		logger: function (message) {console.log(message)}
    //
    // 	}, function(err, sauceConnectProcess) {
    // 		if(err) {
    // 			throw err;
    // 		}
    // console.log('');
    // 		console.log("**** Started Sauce Connect Process ****");
    // console.log('');
    // 		this.sauceConnectProcess = sauceConnectProcess;
    // 		resolve();
    // 	}.bind(this));
    // }.bind(this))
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

    return new Promise(function (resolve) {
      this.bs_local.start(this.bs_local_args, function () {
        console.log('');
        console.log("**** Started BrowserStackLocal Process ****");
        console.log('');
        resolve();
      }.bind(this));
    }.bind(this))

  },

  setFirefoxProfile: function () {

    return Promise.resolve();

    if (this.browserName !== 'firefox') {
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      let myProfile = new FirefoxProfile();

      myProfile.setPreference('plugin.state.flash', 0);
      myProfile.updatePreferences();

      myProfile.encoded(function (encodedProfile) {
        this.cap['firefox_profile'] = encodedProfile;
        resolve();
      }.bind(this));
    }.bind(this));
  },

  getPathOfSeleniumStandalone: function () {
    return new Promise(function (resolve) {

      fs.stat(this.pathOfSeleniumStandalone4dev, function (err, data) {
        if (err || !data.isDirectory()) {
          fs.stat(this.pathOfSeleniumStandalone, function (err, data) {
            if (err || !data.isDirectory()) {
              resolve('');
            } else {
              resolve(this.pathOfSeleniumStandalone)
            }
          }.bind(this));
        } else {
          resolve(this.pathOfSeleniumStandalone4dev);
        }
      }.bind(this));
    }.bind(this));
  },

  setChromeDriver: function () {

    if (this.browserName !== 'chrome') {
      return Promise.resolve();
    }

    return this.getPathOfSeleniumStandalone()
      .then(function (pathOfSeleniumStandalone) {
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
      }.bind(this));
  },

  setGeckoDriver: function () {

    if (this.browserName !== 'firefox') {
      return Promise.resolve();
    }

    return this.getPathOfSeleniumStandalone()
      .then(function (pathOfSeleniumStandalone) {
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
      }.bind(this));
  },


  startSeleniumStandAlone: function () {

    if (this.remoteTesingServer) {
      return Promise.resolve();
    } else {
      return new Promise(function (resolve) {
        selenium.install(this.ssConfig, function () {
          selenium.start(this.ssConfig, function (err, child) {
            if (err) throw err;
            this.childProcessOfSeleniumStandAlone = child;
            resolve(child);
          }.bind(this));
        }.bind(this));
      }.bind(this))
    }
  },

  launchBrowser: function () {
    this.showCapability();
    return this.buildBrowser()
      .then(this.initBrowser.bind(this))
      .then(function () {
        return this.driver;
      }.bind(this));
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
    } catch (error) {
      return this.killAllProcesses()
        .then(function () {
          console.error(error);
        });
    }


    return typeof this.driver.then === 'function' ? this.driver : Promise.resolve();
  },

  initBrowser: function () {

    let timeouts = this.driver.manage().timeouts();
    return Promise.resolve()
      .then(function () {
        if (this.isSauceLabs && this.isMobileOS) {
          this.driver.context('NATIVE_APP');
        }
      }.bind(this))
      .then(timeouts.implicitlyWait.bind(timeouts, 60/*m*/ * 60/*s*/ * 1000/*ms*/))
      .then(timeouts.setScriptTimeout.bind(timeouts, 60/*m*/ * 60/*s*/ * 1000/*ms*/))
      .then(timeouts.pageLoadTimeout.bind(timeouts, 60/*m*/ * 60/*s*/ * 1000/*ms*/))
      .then(function () {
        if (!this.isMobileOS) {
          return this.driver.manage().window().setSize(+this.cap.width || 1024, +this.cap.height || 768);
        }
      }.bind(this))
      .then(function () {
        return this.driver.getSession().then(function (session) {
          this.driver.sessionID = session.id_;
          return session;
        }.bind(this));
      }.bind(this));

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
      argsArray.push(_arg)
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


  saveFullScreenshot: function(page) {

    var capture = new Capture(this);
    var captureUrl = this.getDestPath(this.getFileName4Saving(page.url));

    return this.driver.get(page.url)
      .then(function () {

        console.log(util.colors.help('[start]' + page.url))

        let hasBasicAuthInURL = page.url.match(/https?:\/\/.+:.+@.+/);
        if (hasBasicAuthInURL && !this.isBrowserStack && /safari/.test(this.browserName)) {
          return this.driver.wait(until.elementLocated(By.id('ignoreWarning')), 10/*s*/*1000/*ms*/, 'The button could not found.')
            .then(function (button) {
              return button.click();
            }.bind(this))
            .then(this.driver.sleep.bind(this.driver, 1/*s*/*1000/*ms*/))
            .then(console.log.bind(null, 'Clicked a button to ignore'));
        }
      }.bind(this))
      .then(function () {
        if(typeof page.wd === 'function') {
          return page.wd.bind(this)(this.driver, webdriver)
        }
      }.bind(this))
      .then(function () {
        if(typeof page.wd === 'function') {
          console.log('[page specified function]', util.colors.data('done'));
        }
      }.bind(this))
      .then(function () {
        let timeout = 60/*s*/ * 1000/*ms*/;
        let timeoutMsg = 'unbinding could not be completed.';
        return this.driver.wait(this.executeScript(this.waitForUnbindingBeforeLoad), timeout, timeoutMsg)
          .then(function () {
            console.log('[wait for unbinding before load]', util.colors.data('done'));
          });
      }.bind(this))
      .then(function () {
        return this.executeScript(this.unbindBeforeUnload)
          .then(function () {
            console.log('[unbind before unload]', util.colors.data('done'));
          });
      }.bind(this))
      .then(function () {
        if(this.isMobileOS) {
          if (/android|safari/i.test(this.browserName.toLowerCase())) {
            return capture.saveFullScreenShot(captureUrl);
          } else {
            return capture.saveScreenShot(captureUrl);
          }
        } else {
          if (/chrome|edge|ie|firefox/i.test(this.browserName.toLowerCase())) {
            return capture.saveFullScreenShot(captureUrl);
          } else {
            return capture.saveScreenShot(captureUrl);
          }
        }
      }.bind(this));
  },

  getBrowserLogs: function (page) {
    if (this.cap.browserName !== 'chrome') {
      return Promise.resolve();
    }
    let log = '';

    return this.driver.manage().logs().getAvailableLogTypes()
      .then(function (typeArray) {
        let promises = [];

        typeArray.forEach(function (type) {
          promises.push(this.writeBrowserLogs(type, log, page));
        }.bind(this));

        return Promise.all(promises)
      }.bind(this));
  },
  writeBrowserLogs: function (type, log, page) {
    return this.driver.manage().logs().get(type).then(function (entries) {
      entries.forEach(function (entry) {
        log += `[${entry.level.name}] ${entry.message}\n`;
      }.bind(this));
    }.bind(this))
      .then(function () {
        return new Promise(function (resolve, reject) {
          fs.writeFile(`${this.options.destDir.path}/chrome.log.${type}.txt`, log, {}, function (err) {
            if (err) {
              reject(err)
            }
            console.log(`Completed to write ${this.destPath}/${this.fileName}.txt`);
            log = '';
            resolve();
          }.bind(this));
        }.bind(this));
      }.bind(this));
  },
  sendResult2SauceLabs: function () {
    if (this.isSauceLabs) {
      return new Promise(function (resolve) {
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
    this.killAllProcesses()
      .then(this.sendResult2SauceLabs.bind(this))
      .then(function () {
        console.log('Completed process!');
        // console.timeEnd('hoge');
      }.bind(this))
  }
};

module.exports = Selen;