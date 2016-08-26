process.stdout.write('Running failed test\n');

setInterval(function () {
    process.stdout.write('.');
}, 1000);

setTimeout(function () {
    /*eslint-disable no-process-exit*/
    process.stderr.write('\nTest failed');
    process.exit(1);
    /*eslint-enable no-process-exit*/
}, 10000);
