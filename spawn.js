/**
 * Just a test to see if we can restart telldust from nodejs in case the service crashes/hangs
 */
var sudo = require('sudo');
var options = {};
var child = sudo([ 'service', 'telldusd', 'restart' ], options);

child.stdout.on('data', function (data) {
    console.log(data.toString());
});