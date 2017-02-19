const assert = require("assert");
const Selen = require('../lib/selen.js');
const selen = new Selen({
	browserName: 'chrome'
});
selen.run(function* (driver, webdirver) {
	yield driver.get('http://www.google.com');
	yield driver.sleep(1000);
	yield selen.executeScript(function () {
		document.documentElement.hidden = true;
	});
	let a = yield selen.executeScript(function () {
		return document.documentElement.hidden;
	});
	yield driver.sleep(1000);
	assert(a === true, 'noooooo!');
});