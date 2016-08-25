import Comment from './comment';
import CombinedStatus from './combined-status';
import Status from './status';

export default class PullRequest {
    constructor (githubApi, id, number, commit) {
        this.id        = id;
        this.number    = number;
        this.githubApi = githubApi;
        this.commit    = commit;
    }

    async getLastComment () {
        var curPage      = 1;
        var perPage      = 100;
        var commentsInfo = null;
        var lastInfo     = null;

        do {
            lastInfo     = commentsInfo;
            commentsInfo = await this.githubApi.pullRequests.getComments(this.number, curPage++, perPage);
        }
        while (commentsInfo.length === perPage);

        if (!commentsInfo.length) {
            if (lastInfo)
                commentsInfo = lastInfo;
            else
                return null;
        }

        var lastComment = commentsInfo[commentsInfo.length - 1];

        return new Comment(lastComment.id, lastComment.body);
    }

    async createComment (body) {
        await this.githubApi.pullRequests.createComment(this.number, body);
    }

    async getCombinedStatus () {
        var statusInfo = await this.githubApi.commits.getCombinedStatus(this.commit.sha);

        var statuses = statusInfo.statuses.map(status => new Status(status.state, status.target_url, status.description, status.context));

        return new CombinedStatus(statusInfo.state, statuses);
    }

    async createStatus (state, targetUrl, description, context) {
        return await this.githubApi.commits.createStatus(this.commit.sha, state, targetUrl, description, context);
    }

    async close () {
        return await this.githubApi.pullRequests.update(this.number, PullRequest.STATE.closed);
    }

    async open () {
        return await this.githubApi.pullRequests.update(this.number, PullRequest.STATE.open);
    }
}

PullRequest.STATE = {
    open:   'open',
    closed: 'closed'
};
