import GithubApi from './api';

export default class Repository {
    constructor (user, repo, oauthToken) {
        this.user      = user;
        this.repo      = repo;
        this.githubApi = new GithubApi(oauthToken);
    }

    async createWebhook (url, events) {
        var res = await this.githubApi.repos.createHook(this.user, this.repo, url, events);

        return res.id;
    }

    async deleteWebhook (id) {
        return this.githubApi.repos.deleteHook(this.user, this.repo, id);
    }
}