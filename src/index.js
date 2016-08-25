import WebHookListener from './webhook-listener';
import handlePullRequests from './handle-pull-requests';

export default class GithubBuildBot {
    constructor (port) {
        var webhookListener = new WebHookListener(port);

        handlePullRequests(webhookListener, {
            user:       'gbb-build-bot',
            oauthToken: '63ed0f23748b2831c7968962532a2fcec258798b'
        });
    }

    close () {
        // TODO:
    }
}
