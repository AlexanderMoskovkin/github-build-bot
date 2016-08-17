fixture `Pull requests`;

import { read } from 'read-file-relative';
import * as config from '../../config';
import Repository from '../../../lib/github/repository';

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

async function createPullRequest () {
    //    a) Create a branch
    var fork         = new Repository(config.ORG_MEMBER_USER, config.ORGANIZATION_REPO, config.ORG_MEMBER_OAUTH_KEY);
    var masterBranch = await fork.getBranch('master');

    var branch = await fork.createBranch(`b-${Date.now()}`, masterBranch.commit);

    //    b) Make changes
    await branch.updateFile('10-sec-failed-test.js', await readFile('../../data/succeed-test.js', 'base64'), 'commit1');

    await branch.remove();
}

test('Run tests on pull-request', async () => {
    //  1. Create a pull-request by a team member
    /*eslint-disable*/
    try {
        await createPullRequest();
    }
    catch (err) {
        console.log(err);
    }
    /*eslint-enable*/
//    c) Create a pull-request
//  2. Check tests are run
//    a) Check the comment from build-bot
//    b) Check the status
//  3. Wait for tests are done
//    a) Check the comment from build-bot
//    b) Check the status

//  4. Close pull-request
//  5. Reopen pull-request
//  6. Check tests are run
//    a) Check the comment from build-bot
//    b) Check the status
//  7. Wait for tests are done
//    a) Check the comment from build-bot
//    b) Check the status
//  8. Make an additional commit
//  9. Check the status
//  10. Wait for tests are done
//    a) Check the comment from build-bot
//    b) Check the status
//  11. Close pull-request
//  12. Remove the branch
});
