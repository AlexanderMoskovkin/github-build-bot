export default class Branch {
    constructor (user, repo, name, commit, githubApi) {
        this.user      = user;
        this.repo      = repo;
        this.name      = name;
        this.commit    = commit;
        this.githubApi = githubApi;
    }

    async remove () {
        await this.githubApi.repos.deleteBranch(this.user, this.repo, this.name);
    }

    async updateFile (filePath, content, message) {
        await this.githubApi.repos.updateFile(this.user, this.repo, this.name, filePath, message, content);
    }
}
