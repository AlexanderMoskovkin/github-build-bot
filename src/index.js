import WebHookListener from './webhook-listener';
import handlePullRequests from './handle-pull-requests';

import { BOT_USERNAME, BOT_OAUTH_TOKEN } from '../config';

export default class GithubBuildBot {
    constructor (port) {
        var webhookListener = new WebHookListener(port);

        handlePullRequests(webhookListener, {
            user:       BOT_USERNAME,
            oauthToken: BOT_OAUTH_TOKEN
        });
    }

    close () {
        // TODO:
    }
}
