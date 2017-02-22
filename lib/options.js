"use strict";
const os = /^win/.test(process.platform) ? 'windows' : 'mac';
const moment = require('moment');
const timestamp = moment().format('YYYYMMDDHHmmss');
const git = require('git-rev-sync');

module.exports = {
  mocha: {
    reporter: 'mochawesome',
    reporterOptions: {
      reportDir: `./mochawesome-reports/${os}/${selen.cap.browserName}/${git.branch()}/${git.long()}/${timestamp}/`,
      reportFilename: 'mochawesome.html',
      autoOpen: true
    }
  }
};