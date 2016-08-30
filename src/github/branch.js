import Commit from './commit';

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

    async createFile (filePath, content, message) {
        await this.githubApi.repos.createFile(this.name, filePath, message, content);
    }

    async updateFile (filePath, content, message) {
        var commitSha = await this.githubApi.repos.updateFile(this.name, filePath, message, content);

        return new Commit(this.githubApi, commitSha);
    }

    async replaceFile (filePath, newContentFilePath, commitMessage) {
        return await this.githubApi.repos.replaceFile(filePath, newContentFilePath, this.name, commitMessage);
    }

    async getFileContent (filePath) {
        return await this.githubApi.repos.getContent(this.name, filePath);
    }

    async syncWithCommit (sha) {
        await this.githubApi.repos.syncBranchWithCommit(this.name, sha);
    }
}
