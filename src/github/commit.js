export default class Commit {
    constructor (githubApi, sha) {
        this.githubApi = githubApi;
        this.sha       = sha;
    }

    async getDetailedInfo () {
        var commitInfo = await this.githubApi.commits.get(this.sha);

        return {
            tree:    commitInfo.tree.sha,
            parents: commitInfo.parents.map(parent => parent.sha),
            message: commitInfo.message
        };
    }
}
