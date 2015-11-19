import GitHub from './github';
import GITHUB_MESSAGE_TYPES from './github-message-types';
import { log, saveState }from './log';


const TRAVIS_MESSAGES = {
    progress: 'The Travis CI build is in progress',
    passed:   'The Travis CI build passed',
    failed:   'The Travis CI build failed'
};


export default class MessagesHandler {
    constructor (bot, state, collaborator) {
        this.bot    = bot;
        this.github = new GitHub(bot.name, bot.token);

        if (collaborator)
            this.collaboratorGithub = new GitHub(collaborator.name, collaborator.token);

        this.state = state || { openedPullRequests: {} };

        this.SYNCHRONIZE_TIMEOUT = 5 * 60 * 1000;
    }

    _saveState () {
        var prs   = Object.keys(this.state.openedPullRequests);
        var state = {
            openedPullRequests: {}
        };

        for (var i = 0; i < prs.length; i++) {
            var pr    = this.state.openedPullRequests[prs[i]];
            var clone = {};

            for (var field in pr) {
                if (pr.hasOwnProperty(field) && field !== 'syncTimeout' && field !== 'waitForTestsTimeout')
                    clone[field] = pr[field];
            }

            state.openedPullRequests[prs[i]] = clone;
        }

        saveState(state);
    }

    static _getPRName (repo, id) {
        return `${repo}/${id}`;
    }

    static _getTestBranchName (issueId) {
        return 'rp-' + issueId;
    }

    _getPRBySha (repo, sha) {
        var prNumbers = Object.keys(this.state.openedPullRequests);

        var prId = prNumbers.filter((id) => {
            var pr = this.state.openedPullRequests[id];

            return pr.sha === sha && pr.repo === repo;
        })[0];

        return prId ? this.state.openedPullRequests[prId] : null;
    }

    _onPROpened (repo, prNumber, prSha, branchName, owner) {
        var existedPr = this.state.openedPullRequests[MessagesHandler._getPRName(repo, prNumber)];
        var pr        = existedPr || {};

        pr.number = prNumber;
        pr.sha    = prSha;
        pr.repo   = repo;
        pr.owner  = owner;

        this.state.openedPullRequests[MessagesHandler._getPRName(repo, prNumber)] = pr;

        this._saveState();

        if (existedPr)
            this.github.syncBranchWithCommit(repo, branchName, prSha);
        else
            this.github.createBranch(repo, prSha, branchName);
    }

    _onPRClosed (repo, prNumber, branchName) {
        delete this.state.openedPullRequests[MessagesHandler._getPRName(repo, prNumber)];
        this._saveState();

        this.github.deleteBranch(repo, branchName);
    }

    _waitForTestsStart (pr, repo, owner, sha, targetUrl) {
        var handler = this;
        var botName = this.bot.name;

        if (pr.waitForTestsTimeout) {
            clearTimeout(pr.waitForTestsTimeout);
            pr.waitForTestsTimeout = null;
        }

        pr.timeToTests = Math.round(this.SYNCHRONIZE_TIMEOUT / 60000);

        function setStatus (time) {
            var message = `Tests have been triggered by a modification and will start in ${time} minute.`;

            (handler.collaboratorGithub ||
             handler.github).createStatus(repo, owner, sha, 'pending', targetUrl, message, botName);

            if (time) {
                pr.waitForTestsTimeout = setTimeout(() => {
                    pr.waitForTestsTimeout = null;
                    pr.timeToTests--;

                    if (pr.timeToTests)
                        setStatus(pr.timeToTests);
                }, 60 * 1000);
            }
        }

        setStatus(pr.timeToTests);
    }

    _onPRSynchronized (repo, prNumber, branchName, sha, owner, targetUrl) {
        var pr = this.state.openedPullRequests[MessagesHandler._getPRName(repo, prNumber)];

        if (!pr)
            return;

        delete pr.runningTest;
        pr.sha = sha;

        if (pr.syncTimeout) {
            clearTimeout(pr.syncTimeout);
            delete pr.syncTimeout;
        }

        pr.syncTimeout = setTimeout(() => {
            delete pr.syncTimeout;
            this._saveState();

            this.github.syncBranchWithCommit(repo, branchName, sha);
        }, this.SYNCHRONIZE_TIMEOUT);

        this._saveState();
        this._waitForTestsStart(pr, repo, owner, sha, targetUrl);
    }

    _onPRMessage (body) {
        if (/temp-pr/.test(body.pull_request.base.ref))
            return;

        var owner          = body.repository.owner.login;
        var repo           = body.repository.name;
        var prSha          = body.pull_request.head.sha;
        var prId           = body.pull_request.id;
        var prNumber       = body.number;
        var testBranchName = MessagesHandler._getTestBranchName(prId);

        if (/opened/.test(body.action))
            this._onPROpened(repo, prNumber, prSha, testBranchName, owner);

        if (body.action === 'closed')
            this._onPRClosed(repo, prNumber, testBranchName);

        if (body.action === 'synchronize')
            this._onPRSynchronized(repo, prNumber, testBranchName, prSha, owner, body.target_url);

    }

    _onStatusMessage (body) {
        log('Status message: ' + JSON.stringify(body, null, 4));

        if (!/continuous-integration\/travis-ci\//.test(body.context))
            return;

        var repo = body.repository.name;

        var pr = this._getPRBySha(repo, body.sha);

        if (!pr)
            return;

        var owner = pr.owner;

        if (body.state === 'pending') {
            if (!pr.runningTest) {
                pr.runningTest = body.sha;

                this._saveState();

                (this.collaboratorGithub ||
                 this.github).createStatus(repo, owner, body.sha, 'pending', body.target_url, TRAVIS_MESSAGES.progress, this.bot.name);
            }

            return;
        }

        if (pr.runningTest !== body.sha)
            return;

        pr.runningTest = null;

        this._saveState();

        var success = body.state === 'success';
        var status  = success ? 'passed' : 'failed';
        var emoji   = success ? ':white_check_mark:' : ':x:';

        (this.collaboratorGithub || this.github).createStatus(repo, owner, body.sha, body.state, body.target_url,
            success ? TRAVIS_MESSAGES.passed : TRAVIS_MESSAGES.failed, this.bot.name)
            .then(() => {
                this.github.createPullRequestComment(repo, pr.number,
                    `${emoji} Tests for the commit ${pr.sha} have ${status}. See [details](${body.target_url}).`,
                    owner, repo);
            });
    }

    _onIssueCommentMessage (body) {
        if (body.action !== 'created')
            return;

        var owner = body.repository.owner.login;
        var repo  = body.repository.name;
        var pr    = this.state.openedPullRequests[MessagesHandler._getPRName(repo, body.issue.number)];

        if (!pr)
            return;

        var commandHandler = this._getCommandHandler(body.comment.body);

        if (!commandHandler)
            return;

        this.github.isUserCollaborator(repo, owner, body.comment.user.login)
            .then(isCollaborator => {
                if (isCollaborator)
                    commandHandler(pr, body.issue.id);
            });
    }

    _getCommandHandler (message) {
        if (message.indexOf(`@${this.bot.name}`) < 0)
            return null;

        message = message.replace(`@${this.bot.name}`, '').replace(/\s/g, '');

        var handlers = {
            '\\retest': (pr, issueId) => {
                if (pr.runningTest || pr.syncTimeout)
                    return;

                var prBranchName = MessagesHandler._getTestBranchName(issueId);

                this.github.syncBranchWithCommit(pr.repo, prBranchName, pr.sha);
            }
        };

        return handlers[message] || null;
    }

    handle (message) {
        if (message.type === GITHUB_MESSAGE_TYPES.pullRequest)
            this._onPRMessage(message.body);

        if (message.type === GITHUB_MESSAGE_TYPES.status)
            this._onStatusMessage(message.body);

        if (message.type === GITHUB_MESSAGE_TYPES.issueComment)
            this._onIssueCommentMessage(message.body);
    }
}
