var createTestCafe     = require('testcafe');
var config             = require('./config');
var createNgrokConnect = require('./create-ngrok-connect');
var Repository         = require('../lib/github/repository');
var GithubBuildBot     = require('../lib');
var Promise            = require('Promise');

var LISTENED_EVENTS = ['pull_request'];

var baseRepoWebhookId = null;
var botRepoWebhookId  = null;
var organizationRepo  = new Repository(config.ORGANIZATION_USER, config.ORGANIZATION_REPO, config.ORG_USER_OAUTH_KEY);
var buildBotRepo      = new Repository(config.BUILD_BOT_USER, config.ORGANIZATION_REPO, config.BUILD_BOT_OAUTH_KEY);
var buildBot          = null;

function setup () {
    return createNgrokConnect(config.WEBHOOKS_PORT)
        .then(function (url) {
            return Promise.all([
                organizationRepo.createWebhook(url, LISTENED_EVENTS),
                buildBotRepo.createWebhook(url, ['status'])
            ]);

        })
        .then(function (webhooks) {
            baseRepoWebhookId = webhooks[0];
            botRepoWebhookId  = webhooks[1];

            buildBot = new GithubBuildBot(config.WEBHOOKS_PORT);
        });
}

function teardown () {
    buildBot.close();

    return Promise.all([
        organizationRepo.deleteWebhook(baseRepoWebhookId),
        buildBotRepo.deleteWebhook(botRepoWebhookId)
    ]);
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
