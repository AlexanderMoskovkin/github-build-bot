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
            // optional
            protocol: 'https',
            host:     'api.github.com',
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

    async createStatus (repo, owner, sha, state, targetUrl, description, context) {
        log('createStatus', repo, owner, sha, state, targetUrl, description, context);

        var msg = {
            user:         owner || this.user,
            repo:         repo,
            sha:          sha,
            state:        state,
            'target_url': targetUrl,
            description:  description,
            context:      context
        };

        return makePromise(this.github, this.github.statuses.create, [msg]);
    }

    async isUserCollaborator (repo, owner, user) {
        log('isUserCollaborator', repo, owner, user);

        var msg = {
            repo:       repo,
            user:       owner,
            collabuser: user
        };

        return makePromise(this.github, this.github.repos.getCollaborator, [msg])
            .then(function () {
                return true;
            })
            .catch(function () {
                return false;
            });
    }
}
