import express from 'express';
import bodyParser from 'body-parser';
import { EventEmitter } from 'events';
import MESSAGE_TYPE from './github-message-type';

export default class WebhookListener extends EventEmitter {
    constructor (port) {
        super();

        var app = express();

        app.use(bodyParser.json());

        app.post('/payload', (req, res) => {
            var header      = req.headers['x-github-event'];
            var messageType = null;

            switch (header) {
                case 'pull_request':
                    messageType = MESSAGE_TYPE.pullRequest;
                    break;

                case 'status':
                    messageType = MESSAGE_TYPE.status;
                    break;

                case 'issue_comment':
                    messageType = MESSAGE_TYPE.issueComment;
                    break;

                default:
                    messageType = MESSAGE_TYPE.default;
                    break;
            }

            this.emit('message', {
                type: messageType,
                body: req.body
            });

            res.end();
        });

        app.listen(port, () => {
            process.stdout.write(`Build bot service listening at http://localhost: ${port}`);
        });
    }
};