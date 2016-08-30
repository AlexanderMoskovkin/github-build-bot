import Promise from 'promise';
import Github from 'github';

const MAX_PER_PAGE_VALUE = 100;

/*eslint-disable camelcase*/
export default class GithubApi {
    constructor (user, repo, oauthToken) {
        this.github = new Github({
            version:  '3.0.0',
            protocol: 'https',
            host:     'api.github.com',
            headers:  { 'user-agent': 'github-build-bot' },
            Promise:  Promise,
            timeout:  5000
        });

        this.token = oauthToken;

        this.github.authenticate({ type: 'oauth', token: oauthToken });

        this.user = user;
        this.repo = repo;

        // API
        this.repos        = this._createReposApi();
        this.pullRequests = this._createPullRequestsApi();
        this.commits      = this._createCommitsApi();
    }

    async _sendMsg (fn, msg) {
        msg.user = this.user;
        msg.repo = this.repo;

        return await Promise.denodeify(fn).call(this.github, msg);
    }

    _createReposApi () {
        var get = async () => await this._sendMsg(this.github.repos.get, {});

        var createHook = async (url, events) => {
            var msg = { name: 'web', config: { url, content_type: 'json' }, events, active: true };

            return await this._sendMsg(this.github.repos.createHook, msg);
        };

        var deleteHook = async id => await this._sendMsg(this.github.repos.deleteHook, { id });

        var getBranch = async name => await this._sendMsg(this.github.repos.getBranch, { branch: name });

        var createBranch = async (name, sha) => {
            return await this._sendMsg(this.github.gitdata.createReference, { ref: `refs/heads/${name}`, sha });
        };

        var deleteBranch = async name => await this._sendMsg(this.github.gitdata.deleteReference, { ref: `heads/${name}` });

        var getContent = async (branch, filePath) => {
            return await this._sendMsg(this.github.repos.getContent, { ref: branch, path: filePath });
        };

        var createFile = async (branch, filePath, message, content) => {
            return await this._sendMsg(this.github.repos.createFile, { branch, path: filePath, message, content });
        };

        var updateFile = async (branch, filePath, message, content) => {
            var oldContent = await getContent(branch, filePath);
            var fileSha    = oldContent.sha;
            var msg        = { branch, path: filePath, message, content, sha: fileSha };

            var updateFileInfo = await this._sendMsg(this.github.repos.updateFile, msg);

            return updateFileInfo.commit.sha;
        };

        var replaceFile = async (filePath, newFilePath, branch = 'master', commitMessage) => {
            var newFileInfo = await getContent(branch, newFilePath);
            var newContent  = newFileInfo.content;

            return await updateFile(branch, filePath, commitMessage, newContent);
        };

        var syncBranchWithCommit = async (branchName, sha) => {
            return await this._sendMsg(this.github.gitdata.updateReference, { ref: `heads/${branchName}`, sha, force: true });
        };

        return {
            get,
            createHook,
            deleteHook,
            getBranch,
            createBranch,
            deleteBranch,
            getContent,
            createFile,
            updateFile,
            replaceFile,
            syncBranchWithCommit
        };
    }

    _createPullRequestsApi () {
        var create = async (title, headBranchUser, headBranchName, base = 'master', body) => {
            var isTheSameRepo = headBranchUser === this.user;
            var head          = isTheSameRepo ? headBranchName : `${headBranchUser}:${headBranchName}`;

            return await this._sendMsg(this.github.pullRequests.create, { title, head, base, body });
        };

        var get = async number => await this._sendMsg(this.github.pullRequests.get, { number });

        var getAll = async (state, headUser, headBranch) => {
            return await this._sendMsg(this.github.pullRequests.getAll, {
                state:    state,
                head:     headUser && headBranch ? `${headUser}:${headBranch}` : void 0,
                per_page: MAX_PER_PAGE_VALUE
            });
        };

        var update = async (number, state, title, body) => {
            return await this._sendMsg(this.github.pullRequests.update, { number, title, body, state });
        };

        var getComments = async (prNumber, page, perPage) => {
            return await this._sendMsg(this.github.issues.getComments, { number: prNumber, page, per_page: perPage });
        };

        var getComment = async id => await this._sendMsg(this.github.pullRequests.getComment, { number: id });

        var createComment = async (number, body) => await this._sendMsg(this.github.issues.createComment, { number, body });

        return { create, get, getAll, update, getComments, getComment, createComment };
    }

    _createCommitsApi () {
        var getCombinedStatus = async sha => await this._sendMsg(this.github.repos.getCombinedStatus, { sha });

        var createStatus = async (sha, state, targetUrl, description, context) => {
            return await this._sendMsg(this.github.repos.createStatus, {
                sha, state, target_url: targetUrl, description, context
            });
        };

        var get = async sha => await this._sendMsg(this.github.gitdata.getCommit, { sha });

        var create = async (message, tree, parents) => {
            return await this._sendMsg(this.github.gitdata.createCommit, { message, tree, parents });
        };

        return { getCombinedStatus, createStatus, get, create };
    }
}
/*eslint-enable camelcase*/
