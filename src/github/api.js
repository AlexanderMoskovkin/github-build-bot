import Promise from 'promise';
import Github  from 'github';

export default class GithubApi {
    constructor (oauthToken) {
        this.github = new Github({
            version:  '3.0.0',
            protocol: 'https',
            host:     'api.github.com',
            headers:  { 'user-agent': 'github-build-bot' },
            Promise:  Promise,
            timeout:  5000
        });

        this.github.authenticate({
            type:  'oauth',
            token: oauthToken
        });

        // API
        this.repos = this._createReposApi();
    }

    _createReposApi () {
        var createHook = (user, repo, url, events) => {
            var msg = { user, repo, name: 'web', config: { url, content_type: 'json' }, events, active: true };

            return Promise.denodeify(this.github.repos.createHook).call(this.github, msg);
        };

        var deleteHook = (user, repo, id) => Promise.denodeify(github.repos.deleteHook).call(github, { user, repo, id });

        return { createHook, deleteHook }
    }
}