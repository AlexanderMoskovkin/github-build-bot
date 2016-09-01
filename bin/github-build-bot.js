#!/usr/bin/env node

var GitHubBot = require('../');

var BUILD_BOT_GITHUB_NAME  = process.argv[2];
var BUILD_BOT_GITHUB_TOKEN = process.argv[3];
var SERVER_PORT            = process.argv[4] || '1800';
var COLLABORATOR_NAME      = process.argv[5];
var COLLABORATOR_TOKEN     = process.argv[6];

new GitHubBot(BUILD_BOT_GITHUB_NAME, BUILD_BOT_GITHUB_TOKEN, SERVER_PORT, COLLABORATOR_NAME, COLLABORATOR_TOKEN);
