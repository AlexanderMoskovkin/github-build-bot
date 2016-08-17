import WebHookListener from './webhook-listener';

export default class GithubBuildBot {
    constructor (port) {
        var webhookListener = new WebHookListener(port);

        webhookListener.on('message', ({ type, body }) => {
            this.type = type;
            this.body = body;
        });
    }
}
