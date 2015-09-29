# saucelabs-build-bot

[![Build Status](https://travis-ci.org/AlexanderMoskovkin/github-build-bot.svg?branch=master)](https://travis-ci.org/AlexanderMoskovkin/github-build-bot)

##Install
`$ npm install github-build-bot`

##Usage
```js
var GitHubBot = require('build-bot-github-name');

var BUILD_BOT_GITHUB_NAME  = 'some-build-bot';
var BUILD_BOT_GITHUB_TOKEN = 'abcde12345abcde12345abcde12345abcde12345';
var SERVER_PORT            = '1800';

new GitHubBot(BUILD_BOT_GITHUB_NAME, BUILD_BOT_GITHUB_TOKEN, SERVER_PORT);
```
