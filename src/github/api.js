import Promise from 'promise';
import Github from 'github';

/*eslint-disable camelcase*/
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

    _sendMsg (fn, msg) {
        return Promise.denodeify(fn).call(this.github, msg);
    }

    _createReposApi () {
        var createHook = async (user, repo, url, events) => {
            var msg = { user, repo, name: 'web', config: { url, content_type: 'json' }, events, active: true };

            return await this._sendMsg(this.github.repos.createHook, msg);
        };

        var deleteHook = async (user, repo, id) => await this._sendMsg(this.github.repos.deleteHook, { user, repo, id });

        var getBranch = async (user, repo, name) => {
            return await this._sendMsg(this.github.repos.getBranch, { user, repo, branch: name });
        };

        var createBranch = async (user, repo, name, sha) => {
            return await this._sendMsg(this.github.gitdata.createReference, { user, repo, ref: `refs/heads/${name}`, sha });
        };

        var deleteBranch = async (user, repo, name) => {
            return await this._sendMsg(this.github.gitdata.deleteReference, { user, repo, ref: `heads/${name}` });
        };

        var getContent = async (user, repo, branch, filePath) => {
            return await this._sendMsg(this.github.repos.getContent, { user, repo, ref: branch, path: filePath });

        };

        var updateFile = async (user, repo, branch, filePath, message, content) => {
            var oldContent = await getContent(user, repo, branch, filePath);
            var fileSha    = oldContent.sha;
            var msg        = { user, repo, branch, path: filePath, message, content, sha: fileSha };

            return await this._sendMsg(this.github.repos.updateFile, msg);
        };

        return { createHook, deleteHook, getBranch, createBranch, deleteBranch, getContent, updateFile };
    }
}
/*eslint-enable camelcase*/
