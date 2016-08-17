var i = 0;

process.stdout.write('Running failed test\n');

setInterval(function () {
    process.stdout.write('.');
}, 1000);

setTimeout(function () {
    process.stderr.write('\nTest failed');
    process.exit(1);
}, 10000);