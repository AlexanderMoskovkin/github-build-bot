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

var collaboratorCredentials = {
    name:  'collaborator',
    token: 'collaboratorToken'
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

                id:    id,
                title: 'title'
            },

            number: number
        }
    };
}

function getIssueCommentMessage (action, repo, issueId, issueNumber, user, body) {
    return {
        type: GITHUB_MESSAGE_TYPES.issueComment,
        body: {
            action: action,

            repository: {
                owner: { login: 'repo1Owner' },
                name:  repo
            },

            issue: {
                id:     issueId,
                number: issueNumber,
                title:  'title'
            },

            comment: {
                user: {
                    login: user
                },

                body: body
            }
        }
    };
}

function getTestMessage (state, repo, sha, url, description, context) {
    context = context || 'continuous-integration/travis-ci/';

    return {
        type: GITHUB_MESSAGE_TYPES.status,
        body: {
            sha:         sha,
            target_url:  url,
            state:       state,
            description: description,
            context:     context,

            repository: {
                owner: { login: 'botName' },
                name:  repo
            }
        }
    };
}
/*eslint-enable camelcase*/

describe('Message handler', function () {
    var mh = null;

    // Test setup/teardown
    beforeEach(function () {
        GitHub.prototype = function (user, oauthToken) {
            this.user  = user;
            this.token = oauthToken;
        };

        GitHub.prototype.createBranch             = asyncFuncMock;
        GitHub.prototype.deleteBranch             = asyncFuncMock;
        GitHub.prototype.createPullRequest        = asyncFuncMock;
        GitHub.prototype.mergePullRequest         = asyncFuncMock;
        GitHub.prototype.createPullRequestComment = asyncFuncMock;
        GitHub.prototype.editComment              = asyncFuncMock;
        GitHub.prototype.deleteComment            = asyncFuncMock;
        GitHub.prototype.syncBranchWithCommit     = asyncFuncMock;
        GitHub.prototype.createStatus             = asyncFuncMock;
        GitHub.prototype.isUserCollaborator       = asyncFuncMock;
        GitHub.prototype.getStatuses              = asyncFuncMock;
    });

    afterEach(function () {
        var prs = Object.keys(mh.state.openedPullRequests).map(function (prKey) {
            return mh.state.openedPullRequests[prKey];
        });

        prs.forEach(function (pr) {
            clearInterval(pr.waitForTestsTimeout);
        });

        mh = null;
    });

    // Tests
    it('Should create a branch on a PR opened', function (done) {
        GitHub.prototype.createBranch = function (repo, baseSha, branchName) {
            try {
                expect(repo).eql('repo1');
                expect(baseSha).eql('sha1');
                expect(branchName).eql('rp-pr1');

                done();
            }
            catch (err) {
                done(err);
            }
        };

        mh = new MessagesHandler(botCredentials);

        mh.handle(getPrMessage('opened', 'repo1', 'pr1', 1, 'sha1'));
    });

    it('Should remove the branch on the PR closed', function (done) {
        GitHub.prototype.deleteBranch = function (repo, branchName) {
            try {
                expect(repo).eql('repo1');
                expect(branchName).eql('rp-pr1');

                done();
            }
            catch (err) {
                done(err);
            }
        };

        mh = new MessagesHandler(botCredentials);

        mh.handle(getPrMessage('opened', 'repo1', 'pr1', 1, 'sha1'));
        mh.handle(getPrMessage('closed', 'repo1', 'pr1', 1, 'sha1'));
    });

    it('Should wait for tests after the pr opened', function (done) {
        var expectedPrStates = ['pending', 'pending', 'success'].join(' ');
        var prStates         = [];

        var expectedDescriptions = [
            'The Travis CI build is in progress',
            'The Travis CI build is in progress 2',
            'The Travis CI build has succeeded'
        ].join(' ');

        var descriptions = [];
        var testsDone    = false;

        GitHub.prototype.createStatus = function (repo, owner, sha, state, targetUrl, description, context) {
            try {
                expect(repo).eql('repo1');
                expect(owner).eql('repo1Owner');
                expect(sha).eql('sha1');
                expect(targetUrl).eql('url1');
                expect(context).eql('continuous-integration/travis-ci/');
                expect(this.token).eql(collaboratorCredentials.token);

                prStates.push(state);
                descriptions.push(description);

                return asyncFuncMock();
            }
            catch (err) {
                done(err);
            }
        };

        GitHub.prototype.createPullRequestComment = function (repo, prNumber, comment, owner) {
            try {
                expect(prNumber).eql(1);
                expect(comment.indexOf('pass')).gt(-1);
                expect(comment.indexOf('sha1')).gt(-1);
                expect(comment.indexOf('url1')).gt(-1);
                expect(owner).eql('repo1Owner');
                expect(repo).eql('repo1');
                expect(this.token).eql(botCredentials.token);

                expect(prStates.join(' ')).eql(expectedPrStates);
                expect(descriptions.join(' ')).eql(expectedDescriptions);

                done();
            }
            catch (err) {
                done(err);
            }
        };

        GitHub.prototype.getStatuses = function (repo, owner, branchName) {
            try {
                expect(owner).eql('botName');
                expect(repo).eql('repo1');
                expect(branchName).eql('rp-pr1');
                expect(this.token).eql(botCredentials.token);

                var state   = testsDone ? 'success' : 'pending';
                var message = testsDone ? 'The Travis CI build has succeeded' : 'The Travis CI build is in progress';

                return asyncFuncMock()
                    .then(function () {
                        return {
                            state:    state,
                            statuses: [{ state: state, message: message }]
                        };
                    });
            }
            catch (err) {
                done(err);
            }
        };

        mh = new MessagesHandler(botCredentials, null, collaboratorCredentials);

        asyncFuncMock()
            .then(function () {
                mh.handle(getPrMessage('opened', 'repo1', 'pr1', 1, 'sha1'));
            })
            .then(wait(0))
            .then(function () {
                mh.handle(getTestMessage('pending', 'repo1', 'sha1', 'url1', 'The Travis CI build is in progress'));
                mh.handle(getTestMessage('pending', 'repo1', 'sha1', 'url1', 'The Travis CI build is in progress 2'));
                mh.handle(getTestMessage('pending', 'repo1', 'sha2', 'url2', 'The Travis CI build is in progress'));
                mh.handle(getTestMessage('pending', 'repo2', 'sha3', 'url3', 'The Travis CI build is in progress'));
            })
            .then(wait(0))
            .then(function () {
                testsDone = true;

                mh.handle(getTestMessage('failure', 'repo1', 'sha2', 'url2', 'The Travis CI build has failed'));
                mh.handle(getTestMessage('failure', 'repo2', 'sha3', 'url3', 'The Travis CI build has failed'));
                mh.handle(getTestMessage('success', 'repo1', 'sha1', 'url1', 'The Travis CI build has succeeded'));
            });
    });

    it('Should wait for multiple CI after the pr opened', function (done) {
        var expectedPrStates = {
            'travis':   ['pending', 'success'],
            'appveyor': ['pending', 'failure']
        };

        var prStates = {
            'travis':   [],
            'appveyor': []
        };

        var expectedDescriptions = {
            'travis': [
                'The Travis CI build is in progress',
                'The Travis CI build has succeeded'
            ],
            'appveyor': [
                'The AppVeyor build is in progress',
                'The AppVeyor build has failed'
            ]
        };

        var descriptions = {
            'travis':   [],
            'appveyor': []
        };

        var testsDone = {
            'travis':   false,
            'appveyor': false
        };

        GitHub.prototype.createStatus = function (repo, owner, sha, state, targetUrl, description, context) {
            try {
                expect(repo).eql('repo1');
                expect(owner).eql('repo1Owner');
                expect(sha).eql('sha1');
                expect(targetUrl).eql('url1');
                expect(context).to.be.oneOf(['travis', 'appveyor']);
                expect(this.token).eql(collaboratorCredentials.token);

                prStates[context].push(state);
                descriptions[context].push(description);

                return asyncFuncMock();
            }
            catch (err) {
                done(err);
            }
        };

        GitHub.prototype.createPullRequestComment = function (repo, prNumber, comment, owner) {
            try {
                expect(prNumber).eql(1);
                expect(comment.indexOf('fail')).gt(-1);
                expect(comment.indexOf('sha1')).gt(-1);
                expect(comment.indexOf('url1')).gt(-1);
                expect(owner).eql('repo1Owner');
                expect(repo).eql('repo1');
                expect(this.token).eql(botCredentials.token);

                expect(prStates).eql(expectedPrStates);
                expect(descriptions).eql(expectedDescriptions);

                done();
            }
            catch (err) {
                done(err);
            }
        };

        GitHub.prototype.getStatuses = function (repo, owner, branchName) {
            try {
                expect(owner).eql('botName');
                expect(repo).eql('repo1');
                expect(branchName).eql('rp-pr1');
                expect(this.token).eql(botCredentials.token);

                return asyncFuncMock()
                    .then(function () {
                        return {
                            state:    testsDone['appveyor'] ? 'failure' : 'pending',
                            statuses: [
                                {
                                    context: 'travis',
                                    state:   testsDone['travis'] ? 'success' : 'pending',
                                    message: testsDone['travis'] ? 'The Travis CI build has succeeded' : 'The Travis CI build is in progress'
                                },
                                {
                                    context: 'appveyor',
                                    state:   testsDone['appveyor'] ? 'failure' : 'pending',
                                    message: testsDone['appveyor'] ? 'The AppVeyor build has failed' : 'The AppVeyor build is in progress'
                                }
                            ]
                        };
                    });
            }
            catch (err) {
                done(err);
            }
        };

        mh = new MessagesHandler(botCredentials, null, collaboratorCredentials);

        asyncFuncMock()
            .then(function () {
                mh.handle(getPrMessage('opened', 'repo1', 'pr1', 1, 'sha1'));
            })
            .then(wait(0))
            .then(function () {
                mh.handle(getTestMessage('pending', 'repo1', 'sha1', 'url1', 'The Travis CI build is in progress', 'travis'));
                mh.handle(getTestMessage('pending', 'repo1', 'sha2', 'url2', 'The Travis CI build is in progress', 'travis'));
                mh.handle(getTestMessage('pending', 'repo2', 'sha3', 'url3', 'The Travis CI build is in progress', 'travis'));
            })
            .then(wait(0))
            .then(function () {
                mh.handle(getTestMessage('pending', 'repo1', 'sha1', 'url1', 'The AppVeyor build is in progress', 'appveyor'));
                mh.handle(getTestMessage('pending', 'repo1', 'sha2', 'url2', 'The AppVeyor build is in progress', 'appveyor'));
                mh.handle(getTestMessage('pending', 'repo2', 'sha3', 'url3', 'The AppVeyor build is in progress', 'appveyor'));
            })
            .then(wait(0))
            .then(function () {
                testsDone['appveyor'] = true;

                mh.handle(getTestMessage('success', 'repo1', 'sha2', 'url2', 'The AppVeyor build has succeeded', 'appveyor'));
                mh.handle(getTestMessage('success', 'repo2', 'sha3', 'url3', 'The AppVeyor build has succeeded', 'appveyor'));
                mh.handle(getTestMessage('failure', 'repo1', 'sha1', 'url1', 'The AppVeyor build has failed', 'appveyor'));
            })
            .then(wait(0))
            .then(function () {
                testsDone['travis'] = true;

                mh.handle(getTestMessage('failure', 'repo1', 'sha2', 'url2', 'The Travis CI build has failed', 'travis'));
                mh.handle(getTestMessage('failure', 'repo2', 'sha3', 'url3', 'The Travis CI build has failed', 'travis'));
                mh.handle(getTestMessage('success', 'repo1', 'sha1', 'url1', 'The Travis CI build has succeeded', 'travis'));
            });
    });

    it('Should restart the tests after branch was synchronized', function (done) {
        var synchronizeTimeout = 500;
        var statusChangedCount = 0;
        var synchronizeTime    = null;
        var branchSynchronized = false;
        var expectedStates     = ['pending', 'pending', 'pending', 'pending', 'success'].join(' ');
        var states             = [];
        var testsDone          = false;

        mh = new MessagesHandler(botCredentials);

        mh.SYNCHRONIZE_TIMEOUT = synchronizeTimeout;

        GitHub.prototype.createStatus = function (repo, owner, sha, state) {
            try {
                states.push(state);

                if (!statusChangedCount)
                    expect(sha).eql('sha1');
                else if (statusChangedCount < 2)
                    expect(sha).eql('sha2');
                else
                    expect(sha).eql('sha3');

                statusChangedCount++;

                return asyncFuncMock();
            }
            catch (err) {
                done(err);
            }
        };

        GitHub.prototype.createPullRequestComment = function (repo, prNumber, comment) {
            try {
                expect(states.join(' ')).eql(expectedStates);
                expect(comment.indexOf('pass')).gt(-1);
                expect(comment.indexOf('sha3')).gt(-1);
                expect(branchSynchronized).eql(true);
                done();
            }
            catch (err) {
                done(err);
            }
        };

        GitHub.prototype.syncBranchWithCommit = function (repo, branchName, commitSha) {
            try {
                branchSynchronized = true;

                expect(Date.now() - synchronizeTime).least(synchronizeTimeout);
                expect(repo).eql('repo1');
                expect(branchName).eql('rp-pr1');
                expect(commitSha).eql('sha3');

                return asyncFuncMock();
            }
            catch (err) {
                done(err);
            }
        };

        GitHub.prototype.getStatuses = function (repo, owner, branchName) {
            try {
                expect(owner).eql('botName');
                expect(repo).eql('repo1');
                expect(branchName).eql('rp-pr1');
                expect(this.token).eql(botCredentials.token);

                var state   = testsDone ? 'success' : 'pending';
                var message = testsDone ? 'The Travis CI build has succeeded' : 'The Travis CI build is in progress';

                return asyncFuncMock()
                    .then(function () {
                        return {
                            state:    state,
                            statuses: [{ state: state, message: message }]
                        };
                    });
            }
            catch (err) {
                done(err);
            }
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
                testsDone = true;

                mh.handle(getTestMessage('failed', 'repo1', 'sha1', 'url1'));
                mh.handle(getTestMessage('success', 'repo1', 'sha3', 'url2'));
            });
    });

    it('Should get the state in the constructor', function (done) {
        var branchCreated = false;

        mh = new MessagesHandler(botCredentials, {
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
            try {
                expect(commitSha).eql('sha2');
                expect(branchCreated).eql(false);
                done();
            }
            catch (err) {
                done(err);
            }
        };

        mh.handle(getPrMessage('reopened', 'repo1', 1, '1', 'sha2'));
    });

    it('Should remove the state after branch is closed', function (done) {
        var branchCreatedCount      = 0;
        var branchSynchronizedCount = 0;

        mh = new MessagesHandler(botCredentials);

        GitHub.prototype.createBranch = function () {
            try {
                branchCreatedCount++;

                if (branchCreatedCount === 2) {
                    expect(branchSynchronizedCount).eql(0);

                    done();
                    return null;
                }

                return asyncFuncMock();
            }
            catch (err) {
                done(err);
            }
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
            try {
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
            }
            catch (err) {
                done(err);
            }
        };

        GitHub.prototype.syncBranchWithCommit = function () {
            branchSynchronized = true;

            return asyncFuncMock();
        };

        mh = new MessagesHandler(botCredentials);

        mh.handle(getPrMessage('opened', 'repo1', 'pr1', 1, 'sha1'));
        mh.handle(getPrMessage('opened', 'repo2', 'pr1', 1, 'sha1'));
    });


    describe('build-bot commands', function () {
        it('Restart tests on the \\retest command', function (done) {
            var testsDone = false;

            mh = new MessagesHandler(botCredentials, null, collaboratorCredentials);

            GitHub.prototype.syncBranchWithCommit = function (repo, branchName, commitSha) {
                try {
                    expect(repo).eql('repo1');
                    expect(branchName).eql('rp-pr1');
                    expect(commitSha).eql('sha1');
                    done();
                }
                catch (err) {
                    done(err);
                }
            };

            GitHub.prototype.isUserCollaborator = function () {
                return new Promise(function (resolve) {
                    resolve(true);
                });
            };

            GitHub.prototype.getStatuses = function (repo, owner, branchName) {
                try {
                    expect(owner).eql('botName');
                    expect(repo).eql('repo1');
                    expect(branchName).eql('rp-pr1');
                    expect(this.token).eql(botCredentials.token);

                    var state   = testsDone ? 'success' : 'pending';
                    var message = testsDone ? 'The Travis CI build has succeeded' : 'The Travis CI build is in progress';

                    return asyncFuncMock()
                        .then(function () {
                            return {
                                state:    state,
                                statuses: [{ state: state, message: message }]
                            };
                        });
                }
                catch (err) {
                    done(err);
                }
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
                    testsDone = true;

                    mh.handle(getTestMessage('success', 'repo1', 'sha1', 'url1'));
                })
                .then(wait(0))
                .then(function () {
                    mh.handle(getIssueCommentMessage('created', 'repo1', '123', 1,
                        collaboratorCredentials.name, '@' + botCredentials.name + '  \\retest  '));
                });
        });
    });
});

