import express from 'express';
import bodyParser from 'body-parser';
import { EventEmitter } from 'events';

export default class WebhookListener extends EventEmitter {
    constructor (port) {
        super();

        var app = express();

        app.use(bodyParser.json());

        app.post('/payload', (req, res) => {
            var header = req.headers['x-github-event'];

            this.emit(WebhookListener._getEventByHeader(header), req.body);

            res.end();
        });

        app.listen(port, () => {
            process.stdout.write(`Build bot service listening at http://localhost: ${port}`);
        });
    }

    static _getEventByHeader (header) {
        for (var key in WebhookListener.EVENTS) {
            if (WebhookListener.EVENTS.hasOwnProperty(key) && WebhookListener.EVENTS[key] === header)
                return WebhookListener.EVENTS[key];
        }

        return WebhookListener.EVENTS.default;
    }
}

WebhookListener.EVENTS = {
    pullRequest:  'pull_request',
    status:       'status',
    issueComment: 'issue_comment',
    default:      'default'
};
