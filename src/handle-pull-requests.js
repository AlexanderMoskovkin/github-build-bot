import Promise from 'promise';
import WebHookListener from './webhook-listener';
import Repository from './github/repository';
import Commit from './github/commit';

const PULL_REQUEST_ACTION = {
    opened:      'opened',
    reopened:    'reopened',
    closed:      'closed',
    synchronize: 'synchronize'
};

const TRAVIS_MESSAGE = {
    progress: 'The Travis CI build is in progress',
    passed:   'The Travis CI build passed',
    failed:   'The Travis CI build failed'
};

const botTestBranchPrefix           = 'bot-';
const TRAVIS_CI_CONTEXT_RE          = /continuous-integration\/travis-ci\//;
const CREATE_BRANCH_DELAY           = 5000;
const RUN_TESTS_AFTER_SYNC_PR_DELAY = 2 * 60 * 1000;

var botCredentials = null;
var syncPRTimeout  = null;


function getTestBranchName (pullRequestId) {
    return `${botTestBranchPrefix}${pullRequestId}`;
}

var wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function getPrIdByTestBranchName (branchName) {
    return branchName.replace(botTestBranchPrefix, '');
}

async function onPRMessage (msg) {
    var owner          = msg.repository.owner.login;
    var repoName       = msg.repository.name;
    var prSha          = msg.pull_request.head.sha;
    var prId           = msg.pull_request.id;
    //var title          = msg.pull_request.title;
    var prNumber       = msg.number;
    var testBranchName = getTestBranchName(prId);
    var action         = msg.action;

    var repository = new Repository(owner, repoName, botCredentials.oauthToken);
    var fork       = new Repository(botCredentials.user, repoName, botCredentials.oauthToken);
    var prCommit   = new Commit(prSha);

    var testBranch = await fork.getBranch(testBranchName);

    if (syncPRTimeout)
        clearTimeout(syncPRTimeout);

    if (action === PULL_REQUEST_ACTION.opened || action === PULL_REQUEST_ACTION.reopened) {
        await wait(CREATE_BRANCH_DELAY);

        if (testBranch)
            await testBranch.syncWithCommit(prSha);
        else
            await fork.createBranch(testBranchName, prCommit);

        return;
    }

    if (action === PULL_REQUEST_ACTION.closed) {
        if (testBranch)
            await testBranch.remove();

        return;
    }

    if (action === PULL_REQUEST_ACTION.synchronize) {
        var pullRequest = await repository.getPullRequest(prNumber);
        var message     = `Tests have been triggered by a modification and will start in ${Math.round(RUN_TESTS_AFTER_SYNC_PR_DELAY /
                                                                                                      (60 * 1000))} minutes.`;

        await pullRequest.createStatus('pending', void 0, message, botCredentials.user);

        syncPRTimeout = setTimeout(async () => await testBranch.syncWithCommit(prSha), RUN_TESTS_AFTER_SYNC_PR_DELAY);
    }
}

async function onStatusMessage (msg) {
    if (!TRAVIS_CI_CONTEXT_RE.test(msg.context))
        return;

    var owner     = msg.repository.owner.login;
    var repoName  = msg.repository.name;
    var commitSha = msg.branches[0].commit.sha;
    var prId      = getPrIdByTestBranchName(msg.branches[0].name);

    var repository     = new Repository(owner, repoName, botCredentials.oauthToken);
    var baseRepository = await repository.getBaseRepo();
    var openedPrs      = await baseRepository.getOpenedPullRequests();
    var pr             = openedPrs.filter(p => {
        return p.id.toString() === prId.toString() && p.commit.sha === commitSha;
    })[0];

    if (!pr)
        return;

    if (msg.state === 'pending') {
        await pr.createStatus('pending', msg.target_url, TRAVIS_MESSAGE.progress, botCredentials.user);

        return;
    }

    var success = msg.state === 'success';
    var status  = success ? 'passed' : 'failed';
    var emoji   = success ? ':white_check_mark:' : ':x:';

    await pr.createStatus(msg.state, msg.target_url, success ? TRAVIS_MESSAGE.passed : TRAVIS_MESSAGE.failed, botCredentials.user);
    await pr.createComment(`${emoji} Tests for the commit ${pr.commit.sha} have ${status}. See [details](${msg.target_url}).`);

}

export default function handlePullRequests (webhookListener, { user, oauthToken }) {
    botCredentials = { user, oauthToken };

    webhookListener.on(WebHookListener.EVENTS.pullRequest, onPRMessage);
    webhookListener.on(WebHookListener.EVENTS.status, onStatusMessage);
}
