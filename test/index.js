var createNgrokConnect = require('./create-ngrok-connect');
var BuildBot           = require('../lib');
var Repository         = require('../lib/github/repository');

var WEBHOOKS_PORT      = 1400;
var ORG_USER_OAUTH_KEY = 'edc094db59816a1349f85b302d9c3c80bb72cbea';
var USER               = 'gbb-organization';
var REPO               = 'repository-1';
var LISTENED_EVENTS    = ['pull_request'];

var bot  = new BuildBot(WEBHOOKS_PORT);
var repo = new Repository(USER, REPO, ORG_USER_OAUTH_KEY);

var webhookId = null;

function setup () {
    return createNgrokConnect(WEBHOOKS_PORT)
        .then(url => repo.createWebhook(url, LISTENED_EVENTS))
        .then(id => webhookId = id);
}

function teardown () {
    return repo.deleteWebhook(webhookId);
}

setup()
    .then(() => {
        return new Promise(resolve => {
            setTimeout(resolve, 10000);
        });
    })
    .then(teardown);