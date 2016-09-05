import NodeGitHub from 'github';
import Promise from 'promise';
import { log } from './log';


function makePromise (context, fn, args) {
    return new Promise(function (resolve, reject) {
        fn.apply(context, args.concat(function (err, res) {
            if (err) {
                log('ERROR:' + JSON.stringify(err, null, 4));
                reject(err);
            }
            else
                resolve(res);
        }));
    });
}

export default class GitHub {
    constructor (user, oauthToken) {
        this.githubInitOptions = {
            version:  '3.0.0',
            protocol: 'https',
            host:     'api.github.com',
            Promise:  Promise,
            headers:  { 'user-agent': 'github-build-bot' },
            timeout:  5000
        };

        this.user  = user;
        this.token = oauthToken;

        this.github = new NodeGitHub(this.githubInitOptions);
        this.github.authenticate({
            type:  'oauth',
            token: oauthToken
        });
    }

    //returns new branch name and branch commit sha
    async createBranch (repo, baseSha, branchName) {
        log('createBranch', repo, baseSha, branchName);
        var refName = 'refs/heads/' + branchName;

        var msg = {
            user: this.user,
            repo: repo,
            ref:  refName,
            sha:  baseSha
        };

        return makePromise(this.github.gitdata, this.github.gitdata.createReference, [msg])
            .then(function (data) {
                return new Promise(resolve => resolve({
                    branchName: refName,
                    branchSha:  data.object.sha
                }));
            });
    }

    async deleteBranch (repo, branchName) {
        log('deleteBranch', repo, branchName);
        var refName = 'heads/' + branchName;

        var msg = {
            user: this.user,
            repo: repo,
            ref:  refName
        };

        return makePromise(this.github.gitdata, this.github.gitdata.deleteReference, [msg])
            .then(function () {
                return new Promise(resolve => resolve());
            });
    }

    //returns new pull request number
    async createPullRequest (repo, title, base, head) {
        log('createPullRequest', repo, title, base, head);

        var msg = {
            user:  this.user,
            repo:  repo,
            title: title,
            base:  base,
            head:  head
        };

        return makePromise(this.github.pullRequests, this.github.pullRequests.create, [msg])
            .then(function (res) {
                return new Promise(resolve => resolve(res.number));
            });
    }

    //returns the last commit sha
    async mergePullRequest (repo, commitSha, prNumber, message) {
        log('mergePullRequest', repo, commitSha, prNumber, message);

        var msg = {
            user:   this.user,
            repo:   repo,
            sha:    commitSha,
            number: prNumber
        };

        msg['commit_message'] = message;

        return makePromise(this.github.pullRequests, this.github.pullRequests.merge, [msg])
            .then(function (res) {
                return new Promise(resolve => resolve(res.sha));
            });
    }

    async createPullRequestComment (repo, prNumber, comment, owner) {
        log('createPullRequestComment', repo, prNumber, comment);

        var msg = {
            user:   owner || this.user,
            repo:   repo,
            number: prNumber,
            body:   comment
        };

        return makePromise(this.github.issues, this.github.issues.createComment, [msg])
            .then(function (res) {
                return new Promise(resolve => resolve(res.id));
            });
    }

    async editComment (repo, id, comment, owner) {
        log('editComment', repo, id, comment);

        var msg = {
            user: owner || this.user,
            repo: repo,
            id:   id,
            body: comment
        };

        return makePromise(this.github.issues, this.github.issues.editComment, [msg])
            .then(function (res) {
                return new Promise(resolve => resolve(res));
            });
    }

    async deleteComment (repo, id, owner) {
        log('deleteComment', repo, id);

        var msg = {
            user: owner || this.user,
            repo: repo,
            id:   id
        };

        return makePromise(this.github.issues, this.github.issues.deleteComment, [msg]);
    }

    async syncBranchWithCommit (repo, branchName, commitSha) {
        log('syncBranchWithCommit', repo, branchName, commitSha);

        var msg = {
            user:  this.user,
            repo:  repo,
            ref:   'heads/' + branchName,
            sha:   commitSha,
            force: true
        };

        return makePromise(this.github.gitdata, this.github.gitdata.updateReference, [msg]);
    }

    async getStatuses (repo, owner, branchName) {
        log('getStatuses', repo, owner, branchName);

        var msg = {
            user: owner || this.user,
            repo: repo,
            sha:  branchName
        };

        return makePromise(this.github, this.github.repos.getCombinedStatus, [msg]);
    }

    async createStatus (repo, owner, sha, state, targetUrl, description, context) {
        log('createStatus', repo, owner, sha, state, targetUrl, description, context);

        var msg = {
            user:        owner || this.user,
            repo:        repo,
            sha:         sha,
            state:       state,
            description: description,
            context:     context
        };

        if (targetUrl)
            msg['target_url'] = targetUrl;

        return makePromise(this.github, this.github.repos.createStatus, [msg]);
    }

    async isUserCollaborator (repo, owner, user) {
        log('isUserCollaborator', repo, owner, user);

        var msg = {
            'repo':     repo,
            'user':     owner,
            'per_page': 100
        };

        var collaborators = await makePromise(this.github, this.github.repos.getCollaborators, [msg]);

        return collaborators.map(collaborator => collaborator.login).indexOf(user) > -1;
    }

    async getContent (repo, user, filePath, branch) {
        var msg = {
            repo:   repo,
            user:   user,
            path:   filePath,
            branch: branch || 'master'
        };

        return makePromise(this.github, this.github.repos.getContent, [msg])
            .then(function (res) {
                return res.content;
            });
    }

    // Returns the sha of the replacing commit
    async replaceFile (repo, filePath, newFilePath, branch, commitMessage) {
        var oldFileSha = null;

        var getOldFileContentMsg = {
            repo: repo,
            user: this.user,
            path: filePath,
            ref:  branch || 'master'
        };

        return makePromise(this.github, this.github.repos.getContent, [getOldFileContentMsg])
            .then(res => {
                oldFileSha = res.sha;

                var getNewContentMsg = {
                    repo: repo,
                    user: this.user,
                    path: newFilePath,
                    ref:  branch || 'master'
                };

                return makePromise(this.github, this.github.repos.getContent, [getNewContentMsg]);
            })
            .then(res => {
                var newContent = res.content;

                var updateFileMsg = {
                    repo:    repo,
                    user:    this.user,
                    branch:  branch || 'master',
                    path:    filePath,
                    message: commitMessage,
                    content: newContent,
                    sha:     oldFileSha
                };

                return makePromise(this.github, this.github.repos.updateFile, [updateFileMsg])
                    .then(updatingRes => updatingRes.commit.sha);
            });
    }

    async getCommitMessage (repo, user, sha) {
        var msg = {
            repo: repo,
            user: user,
            sha:  sha
        };

        return makePromise(this.github, this.github.repos.getCommit, [msg])
            .then(res => res.commit.message);
    }
}
