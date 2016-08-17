import GithubApi from './api';
import Branch from './branch';
import Commit from './commit';

export default class Repository {
    constructor (user, repo, oauthToken) {
        this.user      = user;
        this.repo      = repo;
        this.githubApi = new GithubApi(oauthToken);
    }

    // webhooks
    async createWebhook (url, events) {
        var res = await this.githubApi.repos.createHook(this.user, this.repo, url, events);

        return res.id;
    }

    async deleteWebhook (id) {
        return this.githubApi.repos.deleteHook(this.user, this.repo, id);
    }

    // branches
    async getBranch (name) {
        var res    = await this.githubApi.repos.getBranch(this.user, this.repo, name);
        var commit = new Commit(res.commit.sha);

        return new Branch(this.user, this.repo, name, commit);
    }

    async createBranch (name, commit) {
        var branchInfo = await this.githubApi.repos.createBranch(this.user, this.repo, name, commit.sha);

        return new Branch(this.user, this.repo, name, branchInfo.object.sha, this.githubApi);
    }
}
