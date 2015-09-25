var expect               = require('chai').expect;
var Promise              = require('promise');
var GitHub               = require('../lib/github');
var MessagesHandler      = require('../lib/messages-handler');
var GITHUB_MESSAGE_TYPES = require('../lib/github-message-types');
var logger               = require('../lib/log');

logger.log = function () {
};

logger.saveState = function () {
};

var wait = function (ms) {
    return function () {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    };
};

var asyncFuncMock = function () {
    return new Promise(function (resolve) {
        resolve();
    });
};

var botCredentials = {
    name:  'botName',
    token: 'botToken'
};

/*eslint-disable camelcase*/
function getPrMessage (action, repo, id, number, sha) {
    return {
        type: GITHUB_MESSAGE_TYPES.pullRequest,
        body: {
            action: action,

            repository: {
                owner: { login: 'repo1Owner' },
                name:  repo
            },

            pull_request: {
                base: {
                    ref: 'ref'
                },

                head: {
                    sha: sha
                },

                id: id
            },

            number: number
        }
    };
}

function getTestMessage (state, repo, sha, url) {
    return {
        type: GITHUB_MESSAGE_TYPES.status,
        body: {
            sha:        sha,
            target_url: url,
            state:      state,
            repository: {
                owner: { login: 'repo1Owner' },
                name:  repo
            },

            context: 'continuous-integration\/travis-ci\/'
        }
    };
}
/*eslint-enable camelcase*/

describe('Message handler', function () {
    // Test setup/teardown
    beforeEach(function () {
        GitHub.prototype = function () {
        };

        GitHub.prototype.createBranch             = asyncFuncMock;
        GitHub.prototype.deleteBranch             = asyncFuncMock;
        GitHub.prototype.createPullRequest        = asyncFuncMock;
        GitHub.prototype.mergePullRequest         = asyncFuncMock;
        GitHub.prototype.createPullRequestComment = asyncFuncMock;
        GitHub.prototype.editComment              = asyncFuncMock;
        GitHub.prototype.deleteComment            = asyncFuncMock;
        GitHub.prototype.syncBranchWithCommit     = asyncFuncMock;
    });

    afterEach(function () {
    });


    // Tests
    it('Should create a branch on a PR opened', function (done) {
        GitHub.prototype.createBranch = function (repo, baseSha, branchName) {
            expect(repo).eql('repo1');
            expect(baseSha).eql('sha1');
            expect(branchName).eql('rp-pr1');

            done();
        };

        var mh = new MessagesHandler(botCredentials);

        mh.handle(getPrMessage('opened', 'repo1', 'pr1', 1, 'sha1'));
    });

    it('Should remove the branch on the PR closed', function (done) {
        GitHub.prototype.deleteBranch = function (repo, branchName) {
            expect(repo).eql('repo1');
            expect(branchName).eql('rp-pr1');

            done();
        };

        var mh = new MessagesHandler(botCredentials);

        mh.handle(getPrMessage('opened', 'repo1', 'pr1', 1, 'sha1'));
        mh.handle(getPrMessage('closed', 'repo1', 'pr1', 1, 'sha1'));
    });

    it('Should wait for tests after the pr opened', function (done) {
        var startCommentCreatedCount = 0;
        var startCommentDeleted      = false;
        var startCommentId           = 'comment1';

        GitHub.prototype.createPullRequestComment = function (repo, prNumber, comment, owner) {
            if (!startCommentCreatedCount) {
                expect(prNumber).eql(1);
                expect(comment.indexOf('started')).gt(-1);
                expect(comment.indexOf('sha1')).gt(-1);
                expect(comment.indexOf('url1')).gt(-1);
                expect(owner).eql('repo1Owner');
                expect(repo).eql('repo1');

                startCommentCreatedCount++;

                return new Promise(function (resolve) {
                    resolve(startCommentId);
                });
            }

            expect(prNumber).eql(1);
            expect(comment.indexOf('pass')).gt(-1);
            expect(comment.indexOf('sha1')).gt(-1);
            expect(comment.indexOf('url1')).gt(-1);
            expect(owner).eql('repo1Owner');
            expect(repo).eql('repo1');
            expect(startCommentCreatedCount).eql(1);
            expect(startCommentDeleted).eql(true);

            done();
        };

        GitHub.prototype.deleteComment = function (repo, id, owner) {
            expect(id).eql(startCommentId);
            expect(owner).eql('repo1Owner');
            expect(repo).eql('repo1');
            startCommentDeleted = true;

            return asyncFuncMock();
        };

        var mh = new MessagesHandler(botCredentials);

        asyncFuncMock()
            .then(function () {
                mh.handle(getPrMessage('opened', 'repo1', 'pr1', 1, 'sha1'));
            })
            .then(wait(0))
            .then(function () {
                mh.handle(getTestMessage('pending', 'repo1', 'sha1', 'url1'));
                mh.handle(getTestMessage('pending', 'repo1', 'sha1', 'url1'));
                mh.handle(getTestMessage('pending', 'repo1', 'sha2', 'url2'));
                mh.handle(getTestMessage('pending', 'repo2', 'sha3', 'url3'));
            })
            .then(wait(0))
            .then(function () {
                mh.handle(getTestMessage('failure', 'repo1', 'sha2', 'url2'));
                mh.handle(getTestMessage('failure', 'repo2', 'sha3', 'url3'));
                mh.handle(getTestMessage('success', 'repo1', 'sha1', 'url1'));
            });
    });

    it('Should restart the tests after branch was synchronized', function (done) {
        var synchronizeTimeout = 500;
        var commentsCount      = 0;
        var synchronizeTime    = null;
        var branchSynchronized = false;

        var mh = new MessagesHandler(botCredentials);

        mh.SYNCHRONIZE_TIMEOUT = synchronizeTimeout;

        GitHub.prototype.createPullRequestComment = function (repo, prNumber, comment) {
            if (!commentsCount) {
                commentsCount++;

                return new Promise(function (resolve) {
                    resolve('comment1');
                });
            }

            if (commentsCount === 1) {
                expect(comment.indexOf('started')).gt(-1);
                expect(comment.indexOf('sha3')).gt(-1);
                commentsCount++;

                return new Promise(function (resolve) {
                    resolve('comment2');
                });
            }

            expect(comment.indexOf('pass')).gt(-1);
            expect(comment.indexOf('sha3')).gt(-1);
            expect(branchSynchronized).eql(true);
            done();
        };

        GitHub.prototype.deleteComment = function (repo, id) {
            if (commentsCount === 1)
                expect(id).eql('comment1');
            else if (commentsCount === 2)
                expect(id).eql('comment2');
            else
                throw 'should not delete the third comment';
        };

        GitHub.prototype.syncBranchWithCommit = function (repo, branchName, commitSha) {
            branchSynchronized = true;

            expect(Date.now() - synchronizeTime).least(synchronizeTimeout);
            expect(repo).eql('repo1');
            expect(branchName).eql('rp-pr1');
            expect(commitSha).eql('sha3');

            return asyncFuncMock();
        };

        asyncFuncMock()
            .then(function () {
                mh.handle(getPrMessage('opened', 'repo1', 'pr1', 1, 'sha1'));
            })
            .then(wait(0))
            .then(function () {
                mh.handle(getTestMessage('pending', 'repo1', 'sha1', 'url1'));
            })
            .then(wait(0))
            .then(function () {
                synchronizeTime = Date.now();
                mh.handle(getPrMessage('synchronize', 'repo1', 'pr1', 1, 'sha2'));
            })
            .then(wait(0))
            .then(function () {
                synchronizeTime = Date.now();
                mh.handle(getPrMessage('synchronize', 'repo1', 'pr1', 1, 'sha3'));
            })
            .then(wait(synchronizeTimeout))
            .then(function () {
                mh.handle(getTestMessage('pending', 'repo1', 'sha3', 'url2'));
            })
            .then(wait(0))
            .then(function () {
                mh.handle(getTestMessage('failed', 'repo1', 'sha1', 'url1'));
                mh.handle(getTestMessage('success', 'repo1', 'sha3', 'url2'));
            });
    });

    it('Should get the state in the constructor', function (done) {
        var branchCreated = false;

        var mh = new MessagesHandler(botCredentials, {
            openedPullRequests: {
                'repo1/1': {
                    number: 1,
                    sha:    'sha1'
                }
            }
        });

        GitHub.prototype.createBranch = function () {
            branchCreated = true;

            return asyncFuncMock();
        };

        GitHub.prototype.syncBranchWithCommit = function (repo, branchName, commitSha) {
            expect(commitSha).eql('sha2');
            expect(branchCreated).eql(false);
            done();
        };

        mh.handle(getPrMessage('reopened', 'repo1', 1, '1', 'sha2'));
    });

    it('Should remove the state after branch is closed', function (done) {
        var branchCreatedCount      = 0;
        var branchSynchronizedCount = 0;

        var mh = new MessagesHandler(botCredentials);

        GitHub.prototype.createBranch = function () {
            branchCreatedCount++;

            if (branchCreatedCount === 2) {
                expect(branchSynchronizedCount).eql(0);

                done();
                return null;
            }

            return asyncFuncMock();

        };

        GitHub.prototype.syncBranchWithCommit = function () {
            branchSynchronizedCount++;

            return asyncFuncMock();
        };

        mh.handle(getPrMessage('opened', 'repo1', 1, '1', 'sha1'));
        mh.handle(getPrMessage('closed', 'repo1', 1, '1', 'sha1'));
        mh.handle(getPrMessage('reopened', 'repo1', 1, '1', 'sha1'));
    });

    it('Should resolve the same pr id in different repos', function (done) {
        var branchSynchronized = false;
        var branchCreatedCount = 0;

        GitHub.prototype.createBranch = function (repo, baseSha, branchName) {
            if (!branchCreatedCount) {
                branchCreatedCount++;

                expect(repo).eql('repo1');
                expect(baseSha).eql('sha1');
                expect(branchName).eql('rp-pr1');

                return asyncFuncMock();
            }

            expect(repo).eql('repo2');
            expect(baseSha).eql('sha1');
            expect(branchName).eql('rp-pr1');

            expect(branchSynchronized).eql(false);
            done();
        };

        GitHub.prototype.syncBranchWithCommit = function () {
            branchSynchronized = true;

            return asyncFuncMock();
        };

        var mh = new MessagesHandler(botCredentials);

        mh.handle(getPrMessage('opened', 'repo1', 'pr1', 1, 'sha1'));
        mh.handle(getPrMessage('opened', 'repo2', 'pr1', 1, 'sha1'));
    });
});

