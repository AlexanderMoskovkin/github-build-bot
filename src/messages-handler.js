import GitHub from './github';
import GITHUB_MESSAGE_TYPES from './github-message-types';
import { log, saveState, emptyState }from './log';


export default class MessagesHandler {
    constructor (bot, state, collaborator) {
        this.bot    = bot;
        this.github = new GitHub(bot.name, bot.token);

        if (collaborator)
            this.collaboratorGithub = new GitHub(collaborator.name, collaborator.token);

        this.state = state || emptyState();

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

    static _getTemporaryBranchName (branchName) {
        return 'build-bot-temp-' + branchName;
    }

    static _getMark (state) {
        return state === 'success' ? ':white_check_mark:' : ':x:';
    }

    static _getCILink (status) {
        return `[${MessagesHandler._getMark(status.state)}&nbsp;${status.context}](${status.target_url})`;
    }

    static _getDetails (statuses) {
        if (statuses.length === 1)
            return `[details](${statuses[0].target_url})`;

        return 'details:\n\n' +
            statuses
                .map(status => `* ${MessagesHandler._getCILink(status)}`)
                .join('\n\n');
    }

    _getPRBySha (repo, sha) {
        var prNumbers = Object.keys(this.state.openedPullRequests);

        var prId = prNumbers.filter((id) => {
            var pr = this.state.openedPullRequests[id];

            return (pr.sha === sha || pr.travisConfSha === sha) && pr.repo === repo;
        })[0];

        return prId ? this.state.openedPullRequests[prId] : null;
    }

    _createBranch (repo, owner, prSha, branchName, travisConf, prNumber) {
        if (!travisConf)
            return this.github.createBranch(repo, prSha, branchName);

        var temporaryBranchName = MessagesHandler._getTemporaryBranchName(branchName);

        this.github.createBranch(repo, prSha, temporaryBranchName)
            .then(() => this.github.getCommitMessage(repo, owner, prSha))
            .then(commitMessage => {
                return this.github.replaceFile(repo, '.travis.yml', `.travis-${travisConf}.yml`,
                    temporaryBranchName, commitMessage);
            })
            .then(commitSha => {
                this.github.createBranch(repo, commitSha, branchName);

                var currentPr = this.state.openedPullRequests[MessagesHandler._getPRName(repo, prNumber)];

                currentPr.travisConfSha = commitSha;

                this._saveState();
            });
    }

    _syncBranchWithCommit (repo, owner, branchName, prSha, travisConf, prNumber) {
        if (!travisConf)
            return this.github.syncBranchWithCommit(repo, branchName, prSha);

        var temporaryBranchName = MessagesHandler._getTemporaryBranchName(branchName);

        this.github.syncBranchWithCommit(repo, temporaryBranchName, prSha)
            .then(() => this.github.getCommitMessage(repo, owner, prSha))
            .then(commitMessage => {
                return this.github.replaceFile(repo, '.travis.yml', `.travis-${travisConf}.yml`,
                    temporaryBranchName, commitMessage);
            })
            .then(commitSha => {
                this.github.syncBranchWithCommit(repo, branchName, commitSha);

                var currentPr = this.state.openedPullRequests[MessagesHandler._getPRName(repo, prNumber)];

                currentPr.travisConfSha = commitSha;

                this._saveState();
            });
    }

    _getTravisConf (prTitle) {
        if (prTitle.indexOf('[docs]') > -1)
            return 'docs';

        return null;
    }

    _onPROpened (repo, prNumber, prSha, branchName, owner, title) {
        var existedPr = this.state.openedPullRequests[MessagesHandler._getPRName(repo, prNumber)];
        var pr        = existedPr || {};

        pr.number        = prNumber;
        pr.sha           = prSha;
        pr.repo          = repo;
        pr.owner         = owner;
        pr.branchName    = branchName;
        pr.travisConfSha = null;

        this.state.openedPullRequests[MessagesHandler._getPRName(repo, prNumber)] = pr;

        this._saveState();

        if (existedPr)
            this._syncBranchWithCommit(repo, owner, branchName, prSha, this._getTravisConf(title), prNumber);
        else
            this._createBranch(repo, owner, prSha, branchName, this._getTravisConf(title), prNumber);
    }

    _onPRClosed (repo, prNumber, branchName, title) {
        var prName = MessagesHandler._getPRName(repo, prNumber);
        var pr     = this.state.openedPullRequests[prName];

        clearTimeout(pr.waitForTestsTimeout);
        clearTimeout(pr.syncTimeout);

        delete this.state.openedPullRequests[prName];

        this._saveState();

        var travisConf = this._getTravisConf(title);

        this.github.deleteBranch(repo, branchName);

        if (travisConf)
            this.github.deleteBranch(repo, MessagesHandler._getTemporaryBranchName(branchName));
    }

    _waitForTestsStart (pr, repo, owner, sha, statuses) {
        var handler = this;

        if (pr.waitForTestsTimeout) {
            clearTimeout(pr.waitForTestsTimeout);
            pr.waitForTestsTimeout = null;
        }

        pr.timeToTests = Math.round(this.SYNCHRONIZE_TIMEOUT / 60000);

        function setStatus (time) {
            var message = `Tests will start in ${time} minute(s).`;

            statuses.forEach(status => (handler.collaboratorGithub ||
                handler.github).createStatus(repo, owner, sha, 'pending', '', message, status.context));

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

    async _onPRSynchronized (repo, prNumber, branchName, sha, owner, title) {
        var pr = this.state.openedPullRequests[MessagesHandler._getPRName(repo, prNumber)];

        if (!pr)
            return;

        var statusInfo = await this.github.getCombinedStatus(repo, this.bot.name, branchName);

        pr.sha = sha;

        if (pr.syncTimeout) {
            clearTimeout(pr.syncTimeout);
            delete pr.syncTimeout;
        }

        pr.syncTimeout = setTimeout(() => {
            delete pr.syncTimeout;
            this._saveState();

            this._syncBranchWithCommit(repo, owner, branchName, sha, this._getTravisConf(title), prNumber);
        }, this.SYNCHRONIZE_TIMEOUT);

        this._saveState();

        this._waitForTestsStart(pr, repo, owner, sha, statusInfo.statuses);
    }

    _onPRMessage (body) {
        if (/temp-pr/.test(body.pull_request.base.ref))
            return;

        var owner          = body.repository.owner.login;
        var repo           = body.repository.name;
        var prSha          = body.pull_request.head.sha;
        var prId           = body.pull_request.id;
        var title          = body.pull_request.title;
        var prNumber       = body.number;
        var testBranchName = MessagesHandler._getTestBranchName(prId);

        if (/opened/.test(body.action))
            this._onPROpened(repo, prNumber, prSha, testBranchName, owner, title);

        if (body.action === 'closed')
            this._onPRClosed(repo, prNumber, testBranchName, title);

        if (body.action === 'synchronize')
            this._onPRSynchronized(repo, prNumber, testBranchName, prSha, owner, title);
    }

    async _onStatusMessage (body) {
        log('Status message: ' + JSON.stringify(body, null, 4));

        if (body.repository.owner.login !== this.bot.name)
            return;

        var repo = body.repository.name;

        var pr = this._getPRBySha(repo, body.sha);

        if (!pr)
            return;

        var statusInfo = await this.github.getCombinedStatus(repo, this.bot.name, pr.branchName);

        if (statusInfo.sha !== body.sha)
            return;

        var owner = pr.owner;

        (this.collaboratorGithub || this.github).createStatus(repo, owner, pr.sha, body.state, body.target_url,
            body.description, body.context);


        if (statusInfo.state === 'pending' || statusInfo.statuses.some(status => status.state === 'pending'))
            return;

        var status  = statusInfo.state === 'success' ? 'passed' : 'failed';
        var mark    = MessagesHandler._getMark(statusInfo.state);
        var details = MessagesHandler._getDetails(statusInfo.statuses);

        this.github.createPullRequestComment(repo, pr.number,
            `${mark}&nbsp;Tests for the commit ${pr.sha} have ${status}. See ${details}.`, owner, repo);
    }

    _onIssueCommentMessage (body) {
        if (body.action !== 'created')
            return;

        var owner = body.repository.owner.login;
        var repo  = body.repository.name;
        var pr    = this.state.openedPullRequests[MessagesHandler._getPRName(repo, body.issue.number)];

        if (!pr)
            return;

        var commandHandler = this._getCommandHandler(body.comment.body, body.issue.title);

        if (!commandHandler)
            return;

        this.github.isUserCollaborator(repo, owner, body.comment.user.login)
            .then(isCollaborator => {
                if (isCollaborator)
                    commandHandler(pr);
            });
    }

    _getCommandHandler (message, title) {
        var name = this.bot.name;

        if (message.indexOf(`@${name}`) < 0)
            return null;

        message = message.replace(`@${name}`, '').replace(/\s/g, '');


        var handlers = {
            '\\retest': async pr => {
                var statusInfo = await this.github.getCombinedStatus(pr.repo, name, pr.branchName);

                if (statusInfo.statuses.some(status => status.state === 'pending') || pr.syncTimeout)
                    return;

                this._syncBranchWithCommit(pr.repo, pr.owner, pr.branchName, pr.sha, this._getTravisConf(title), pr.number);
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
