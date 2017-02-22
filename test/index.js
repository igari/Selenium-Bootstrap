
'use strict';

const child_process = require('child_process');

//TODO: implement!
const child = child_process.spawn('../bin/selen', ['./test/spec/']);
//
// child.stdout.on('data', function(data) {
//   console.log(data.toString());
// });
// child.on('error', function(data) {
//   console.log(data.toString());
// });
// child.on('exit', function(code, signal) {
//   console.log(`exited with code: ${code}`);
//   process.on('exit', function () {
//     if (signal) {
//       process.kill(process.pid, signal);
//     } else {
//       process.exit(code);
//     }
//   });
// });
// child.on('close', function(code) {
//   console.log(`closed with code: ${code}`);
// });
//
// // terminate children.
// process.on('SIGINT', function () {
//   child.kill('SIGINT'); // calls runner.abort()
//   child.kill('SIGTERM'); // if that didn't work, we're probably in an infinite loop, so make it die.
// });