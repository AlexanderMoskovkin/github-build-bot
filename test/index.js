var createTestCafe     = require('testcafe');
var config             = require('./config');
var createNgrokConnect = require('./create-ngrok-connect');
var Repository         = require('../lib/github/repository');

var LISTENED_EVENTS = ['pull_request'];

var webhookId        = null;
var organizationRepo = new Repository(config.ORGANIZATION_USER, config.ORGANIZATION_REPO, config.ORG_USER_OAUTH_KEY);

function setup () {
    return createNgrokConnect(config.WEBHOOKS_PORT)
        .then(function (url) {
            return organizationRepo.createWebhook(url, LISTENED_EVENTS);
        })
        .then(function (id) {
            webhookId = id;
        });
}

function teardown () {
    return organizationRepo.deleteWebhook(webhookId);
}

var failedTests = 0;

module.exports = function run (src) {
    return setup()
        .then(function () {
            return createTestCafe();
        })
        .then(function (tc) {
            return tc
                .createRunner()
                .src(src)
                .browsers('chrome')
                .run();
        })
        .catch(function (err) {
            process.stderr.write(err + '\n');

            return teardown()
                .then(function () {
                    throw new Error(err);
                });
        })
        .then(function (failed) {
            failedTests = failed;

            return teardown();
        })
        .then(function () {
            if (failedTests)
                throw new Error('Tests are failed');
        });
};
