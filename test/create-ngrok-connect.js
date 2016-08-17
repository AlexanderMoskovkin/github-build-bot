var ngrok   = require('ngrok');
var Promise = require('promise');

module.exports = function createNgrokConnect (port) {
    return new Promise((resolve, reject) => {
        ngrok.connect({
            proto: 'http',
            addr:  port
        }, (err, url) => {
            if (err)
                reject(err);
            else
                resolve(url + '/payload');
        })
    });
};
