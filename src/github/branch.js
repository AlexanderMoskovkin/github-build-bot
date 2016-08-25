export default class Branch {
    constructor (githubApi, user, repo, name, commit) {
        this.user      = user;
        this.repo      = repo;
        this.name      = name;
        this.commit    = commit;
        this.githubApi = githubApi;
    }

    async remove () {
        await this.githubApi.repos.deleteBranch(this.name);
    }

    async updateFile (filePath, content, message) {
        await this.githubApi.repos.updateFile(this.name, filePath, message, content);
    }
}
