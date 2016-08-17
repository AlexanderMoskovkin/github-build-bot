var GitHubApi = require('github');
var Promise   = require('promise');

module.exports = class Github {
    constructor (oauthToken) {
        this.api = new GitHubApi({
            version:  '3.0.0',
            protocol: 'https',
            host:     'api.github.com',
            headers:  { 'user-agent': 'github-build-bot' },
            Promise:  Promise,
            timeout:  5000
        });

        this.api.authenticate({
            type:  'oauth',
            token: oauthToken
        });
    }

    createWebhook (user, repo, url, events) {
        return new Promise((resolve, reject) => {
            this.api.repos.createHook({
                user:   user,
                repo:   repo,
                name:   'web',
                config: {
                    url:          url,
                    content_type: 'json'
                },
                events: events,
                active: true

            }, function (err, res) {
                if (err)
                    reject(err);
                else
                    resolve(res.id);
            });
        });
    }

    deleteWebhook (user, repo, id) {
        return new Promise((resolve, reject) => {
            this.api.repos.deleteHook({
                user: user,
                repo: repo,
                id:   id
            }, function (err, res) {
                if (err)
                    reject(err);
                else
                    resolve(res.id);
            });
        });
    }
}