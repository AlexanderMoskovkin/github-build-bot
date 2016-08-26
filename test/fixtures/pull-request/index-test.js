import { read } from 'read-file-relative';
import { expect } from 'chai';
import Status from '../../../lib/github/status';
import * as config from '../../config';
import Repository from '../../../lib/github/repository';


var testBranch      = null;
var testPullRequest = null;

fixture `Pull requests`
    .beforeEach(async () => {
        log('SETUP: Create a pull-request by a team member', 1000);
        var { branch, pullRequest } = await createPullRequest();

        testBranch      = branch;
        testPullRequest = pullRequest;
    })
    .afterEach(async () => {
        log('TEARDOWN: Close pull-request');
        await testPullRequest.close();

        log('TEARDOWN: Remove the branch\n');
        await testBranch.remove();
    });

const LOGGING_INTERVAL = 15 * 1000;

var loggingInterval = null;

function log (msg, delay) {
    if (loggingInterval)
        clearInterval(loggingInterval);

    setTimeout(() => process.stdout.write(`\n${msg}`), delay);

    loggingInterval = setInterval(() => process.stdout.write(`.`), LOGGING_INTERVAL);
}

var readFile = (path, encoding) => {
    return new Promise((resolve, reject) => {
        read(path, encoding, (err, res) => {
            if (err)
                reject(err);
            else
                resolve(res);
        });
    });
};

var wait = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

async function createPullRequest () {
    // a) Create a branch
    var upstream     = new Repository(config.ORGANIZATION_USER, config.ORGANIZATION_REPO, config.ORG_USER_OAUTH_KEY);
    var fork         = new Repository(config.ORG_MEMBER_USER, config.ORGANIZATION_REPO, config.ORG_MEMBER_OAUTH_KEY);
    var masterBranch = await fork.getBranch('master');
    var branch       = await fork.createBranch(`b-${Date.now()}`, masterBranch.commit);

    // b) Make changes
    await branch.updateFile('test.js', await readFile('../../data/succeed-test.js', 'base64'), 'commit1');

    // fetch changes
    branch = await fork.getBranch(branch.name);

    // c) Create a pull-request
    var pullRequest = await upstream.createPullRequest('title', branch);

    return { branch, pullRequest };
}

async function runWithWatchdog (fn, timeout, interval) {
    var timeoutExpired = false;

    var runTimeout = async () => {
        await wait(timeout);
        timeoutExpired = true;
    };

    var execFn = async () => {
        var res = null;

        while (!res) {
            res = await fn();

            if (!res) {
                if (timeoutExpired)
                    break;
                else
                    await wait(interval);
            }
        }

        return res;
    };

    runTimeout();

    var res = await execFn();

    if (!res)
        throw new Error('Timeout expired');

    return res;
}

async function checkLastCommentBody (pullRequest, commentRe, timeout, prevCommentId) {
    if (typeof commentRe === 'string')
        commentRe = new RegExp(commentRe);

    var getComment = async () => {
        var comment = await pullRequest.getLastComment();

        if (!comment)
            return null;

        return prevCommentId && comment.id === prevCommentId ? null : comment;
    };

    var lastComment = await runWithWatchdog(getComment, timeout, 2000);

    if (!commentRe.test(lastComment && lastComment.body))
        throw new Error(`The last comment is ${lastComment && lastComment.body} but should match ${commentRe}`);
}

var getPRStatusWithState = async (pullRequest, state) => {
    var combinedStatus = await pullRequest.getCombinedStatus();

    return combinedStatus.statuses.length === 1 && combinedStatus.statuses[0].state === state ?
           combinedStatus.statuses[0] : null;
};

async function checkCommitStatus (pullRequest, state, descriptionRe, timeout) {
    if (typeof descriptionRe === 'string')
        descriptionRe = new RegExp(descriptionRe);

    var combinedStatus = await runWithWatchdog(async () => {
        return await getPRStatusWithState(pullRequest, state);
    }, timeout, 2000);

    if (!descriptionRe.test(combinedStatus.description))
        throw new Error(`The status description is ${combinedStatus.description} but should match ${descriptionRe}`);
}

const TESTS_PASSED_COMMENT_RE     = /Tests for the commit\s[0-9a-f]*\shave passed/;
const TESTS_FAILED_COMMENT_RE     = /Tests for the commit\s[0-9a-f]*\shave failed/;
const TESTS_IN_PROGRESS_STATUS_RE = /The Travis CI build is in progress/;
const TESTS_PASSED_STATUS_RE      = /The Travis CI build passed/;
const TESTS_FAILED_STATUS_RE      = /The Travis CI build failed/;
const TESTS_PENDING_STATUS_RE     = /Tests have been triggered by a modification and will start in\s[0-9]*\sminutes/;

const WAIT_FOR_TESTS_STARTED_TIMEOUT     = 2 * 60 * 1000;
const WAIT_FOR_TESTS_FINISHED_TIMEOUT    = 10 * 60 * 1000;
const ADDITIONAL_COMMIT_TEST_START_DELAY = 3 * 60 * 1000;
const GITHUB_ACTIONS_DELAY               = 5 * 1000;

test('Run tests on pull-request', async () => {
    log('1. Check tests are run');
    log('    a) Check the status');
    await checkCommitStatus(testPullRequest, Status.STATE.pending, TESTS_IN_PROGRESS_STATUS_RE, WAIT_FOR_TESTS_STARTED_TIMEOUT);

    log('2. Wait for tests are done');
    log('    a) Check the comment from build-bot');
    await checkLastCommentBody(testPullRequest, TESTS_PASSED_COMMENT_RE, WAIT_FOR_TESTS_FINISHED_TIMEOUT);

    log('    b) Check the status');
    var combinedStatus = await testPullRequest.getCombinedStatus();

    expect(combinedStatus.statuses.length).to.be.eql(1);
    expect(combinedStatus.statuses[0].state).to.be.eql(Status.STATE.success);
    expect(TESTS_PASSED_STATUS_RE.test(combinedStatus.statuses[0].description)).to.be.true;

    log('3. Close pull-request');
    await testPullRequest.close();
    await wait(GITHUB_ACTIONS_DELAY);

    log('4. Reopen pull-request');
    await testPullRequest.open();

    // NOTE: add a comment to separate build-bot comments
    var separatingComment = await testPullRequest.createComment('separator');

    log('5. Check tests are run');
    log('    a) Check the status');
    await checkCommitStatus(testPullRequest, Status.STATE.pending, TESTS_IN_PROGRESS_STATUS_RE, WAIT_FOR_TESTS_STARTED_TIMEOUT);

    log('6. Wait for tests are done');
    log('    a) Check the comment from build-bot');
    await checkLastCommentBody(testPullRequest, TESTS_PASSED_COMMENT_RE, WAIT_FOR_TESTS_FINISHED_TIMEOUT, separatingComment.id);

    log('    b) Check the status');
    combinedStatus = await testPullRequest.getCombinedStatus();

    expect(combinedStatus.statuses.length).to.be.eql(1);
    expect(combinedStatus.statuses[0].state).to.be.eql(Status.STATE.success);
    expect(TESTS_PASSED_STATUS_RE.test(combinedStatus.statuses[0].description)).to.be.true;

    log('7. Make an additional commit');
    await testBranch.updateFile('test.js', await readFile('../../data/failed-test.js', 'base64'), 'commit2');
    await testPullRequest.fetch();

    log('8. Check the status');
    log('    a) Check waiting for tests status');
    await checkCommitStatus(testPullRequest, Status.STATE.pending, TESTS_PENDING_STATUS_RE, WAIT_FOR_TESTS_STARTED_TIMEOUT);

    log('    b) Wait for tests for additional commit tests started');
    await wait(ADDITIONAL_COMMIT_TEST_START_DELAY);

    log('    c) Check running tests status');
    await checkCommitStatus(testPullRequest, Status.STATE.pending, TESTS_IN_PROGRESS_STATUS_RE, WAIT_FOR_TESTS_STARTED_TIMEOUT);

    // NOTE: add a comment to separate build-bot comments
    separatingComment = await testPullRequest.createComment('separator');

    log('9. Wait for tests are done');
    log('    a) Check the comment from build-bot');
    await checkLastCommentBody(testPullRequest, TESTS_FAILED_COMMENT_RE, WAIT_FOR_TESTS_FINISHED_TIMEOUT, separatingComment.id);

    log('    b) Check the status');
    combinedStatus = await testPullRequest.getCombinedStatus();

    expect(combinedStatus.statuses.length).to.be.eql(1);
    expect(combinedStatus.statuses[0].state).to.be.eql(Status.STATE.failure);
    expect(TESTS_FAILED_STATUS_RE.test(combinedStatus.statuses[0].description)).to.be.true;
});
