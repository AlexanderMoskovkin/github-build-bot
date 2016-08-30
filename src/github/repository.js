import GithubApi from './api';
import Branch from './branch';
import Commit from './commit';
import PullRequest from './pull-request';

export default class Repository {
    constructor (user, repo, oauthToken) {
        this.user       = user;
        this.repo       = repo;
        this.oauthToken = oauthToken;
        this.githubApi  = new GithubApi(this.user, this.repo, oauthToken);
    }

    // repo
    async getBaseRepo () {
        var repoInfo = await this.githubApi.repos.get();

        if (!repoInfo.source)
            return null;

        return new Repository(repoInfo.source.owner.login, repoInfo.source.name, this.oauthToken);
    }

    // webhooks
    async createWebhook (url, events) {
        var res = await this.githubApi.repos.createHook(url, events);

        return res.id;
    }

    async deleteWebhook (id) {
        return this.githubApi.repos.deleteHook(id);
    }

    // branches
    async getBranch (name) {
        try {
            var res = await this.githubApi.repos.getBranch(name);
        }
        catch (err) {
            return null;
        }

        return new Branch(this.githubApi, this.user, this.repo, name, new Commit(this.githubApi, res.commit.sha));
    }

    async createBranch (name, commit) {
        var branchInfo = await this.githubApi.repos.createBranch(name, commit.sha);

        return new Branch(this.githubApi, this.user, this.repo, name, new Commit(this.githubApi, branchInfo.object.sha));
    }

    // pull requests
    async createPullRequest (title, headBranch, base = 'master', body) {
        var prInfo = await this.githubApi.pullRequests.create(title, headBranch.user, headBranch.name, base, body);

        return new PullRequest(this.githubApi, prInfo.id, prInfo.number, headBranch.commit);
    }

    async getPullRequest (number) {
        var prInfo = await this.githubApi.pullRequests.get(number);

        return new PullRequest(this.githubApi, prInfo.id, prInfo.number, new Commit(this.githubApi, prInfo.head.sha));
    }

    async getOpenedPullRequests (headUser, headBranchName) {
        var prsInfo = await this.githubApi.pullRequests.getAll('open', headUser, headBranchName);

        return prsInfo.map(prInfo => new PullRequest(this.githubApi, prInfo.id, prInfo.number, new Commit(this.githubApi, prInfo.head.sha)));
    }

    // commits
    async createCommit (message, tree, parents) {
        var commitInfo = await this.githubApi.commits.create(message, tree, parents);

        return new Commit(this.githubApi, commitInfo.sha);
    }
}
