//
// copyright
//


var common = require('../common');
var assert = require('assert');

var net = require('net');

assert.equal(typeof net.hello,'function');

assert.equal(net.hello(),'world');

console.log('ok');
