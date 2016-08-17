process.stdout.write('Running succeed test\n');

setInterval(function () {
    process.stdout.write('.');
}, 1000);

setTimeout(function () {
    /*eslint-disable no-process-exit*/
    process.stderr.write('\nTest passed');
    process.exit(0);
    /*eslint-enable no-process-exit*/
}, 10000);
