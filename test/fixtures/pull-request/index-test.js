fixture `Pull requests`;

import { read } from 'read-file-relative';
import { expect } from 'chai';
import Status from '../../../lib/github/status';
import * as config from '../../config';
import Repository from '../../../lib/github/repository';

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

async function checkLastCommentBody (pullRequest, commentRe, timeout) {
    if (typeof commentRe === 'string')
        commentRe = new RegExp(commentRe);

    var getComment  = async () => await pullRequest.getLastComment();
    var lastComment = await runWithWatchdog(getComment, timeout, 2000);

    if (!commentRe.test(lastComment && lastComment.body))
        throw new Error(`The last comment is ${lastComment && lastComment.body} but should match ${commentRe}`);
}

const TESTS_PASSED_RE                 = /Tests for the commit\s[0-9a-f]*\shave passed/;
const WAIT_FOR_TESTS_STARTED_TIMEOUT  = 2 * 60 * 1000;
const WAIT_FOR_TESTS_FINISHED_TIMEOUT = 10 * 60 * 1000;

test('Run tests on pull-request', async () => {
    /*eslint-disable*/
    var error = null;

    try {
        log('1. Create a pull-request by a team member', 1000);
        var { branch, pullRequest } = await createPullRequest();

        log('2. Check tests are run');
        log('    a) Check the status');
        await runWithWatchdog(async () => {
            var combinedStatus = await pullRequest.getCombinedStatus();

            return combinedStatus.statuses.length === 1 && combinedStatus.statuses[0].state === Status.STATE.pending;
        }, WAIT_FOR_TESTS_STARTED_TIMEOUT, 2000);

        log('3. Wait for tests are done');
        log('    a) Check the comment from build-bot');
        await checkLastCommentBody(pullRequest, TESTS_PASSED_RE, WAIT_FOR_TESTS_FINISHED_TIMEOUT);

        log('    b) Check the status');
        var combinedStatus = await pullRequest.getCombinedStatus();

        expect(combinedStatus.statuses.length).to.be.eql(1);
        expect(combinedStatus.statuses[0].state).to.be.eql(Status.STATE.success);

        log('4. Close pull-request');
        await pullRequest.close();

        log('5. Reopen pull-request');
        await pullRequest.open();

        log('6. Check tests are run');
        log('    a) Check the status');
        await runWithWatchdog(async () => {
            var combinedStatus = await pullRequest.getCombinedStatus();

            return combinedStatus.statuses.length === 1 && combinedStatus.statuses[0].state === Status.STATE.pending;
        }, WAIT_FOR_TESTS_STARTED_TIMEOUT, 2000);

        log('7. Wait for tests are done');
        log('    a) Check the comment from build-bot');
        await checkLastCommentBody(pullRequest, TESTS_PASSED_RE, WAIT_FOR_TESTS_FINISHED_TIMEOUT);

        log('    b) Check the status');
        combinedStatus = await pullRequest.getCombinedStatus();

        expect(combinedStatus.statuses.length).to.be.eql(1);
        expect(combinedStatus.statuses[0].state).to.be.eql(Status.STATE.success);
    }
    catch (err) {
        console.log(`\n${err}`);
        error = err;
    }
    finally {
        await pullRequest.close();
        await branch.remove();
    }
    /*eslint-enable*/

    if (error)
        throw new Error(error);


//  8. Make an additional commit
//  9. Check the status
//  10. Wait for tests are done
//    a) Check the comment from build-bot
//    b) Check the status
//  11. Close pull-request
//  12. Remove the branch
});
