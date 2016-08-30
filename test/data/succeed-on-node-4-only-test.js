process.stdout.write('Running succeed on node 4 only test\n');

setInterval(function () {
    process.stdout.write('.');
}, 1000);

setTimeout(function () {
    /*eslint-disable no-process-exit*/
    if (/^v4\./.test(process.version)) {
        process.stdout.write('\nTest passed');
        process.exit(0);
    }

    process.stdout.write('\nNode version is ' + process.version + ' instead of v4.x');
    process.exit(1);
    /*eslint-enable no-process-exit*/
}, 10000);
