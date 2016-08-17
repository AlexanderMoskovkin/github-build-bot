import express from 'express';
import bodyParser from 'body-parser';
import MessagesHandler from './messages-handler.js';
import GITHUB_MESSAGE_TYPES from './github-message-types';
import { readState } from './log';

export default class BuildBot {
    constructor (botUsername, botOauthToken, webhooksPort, collaboratorUsername, collaboratorOauthToken) {
        this.bot = {
            name:  botUsername,
            token: botOauthToken
        };

        if (collaboratorUsername && collaboratorOauthToken) {
            this.collaborator = {
                name:  collaboratorUsername,
                token: collaboratorOauthToken
            };
        }

        this.port = webhooksPort;

        this.messagesHandler = new MessagesHandler(this.bot, readState(), this.collaborator);
        this._runServer();
    }

    _runServer () {
        var app = express();

        app.use(bodyParser.json());

        app.post('/payload', (req, res) => {
            var header = req.headers['x-github-event'];
            var type   = '';

            if (header === 'pull_request')
                type = GITHUB_MESSAGE_TYPES.pullRequest;
            else if (header === 'status')
                type = GITHUB_MESSAGE_TYPES.status;
            else if (header === 'issue_comment')
                type = GITHUB_MESSAGE_TYPES.issueComment;
            else
                type = GITHUB_MESSAGE_TYPES.default;

            this.messagesHandler.handle({
                type: type,
                body: req.body
            });
            res.end();
        });

        app.listen(this.port, () => {
            process.stdout.write(`Build bot service listening at http://localhost:${this.port}`);
        });
    }
}
