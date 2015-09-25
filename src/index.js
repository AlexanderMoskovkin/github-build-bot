import express from 'express';
import bodyParser from 'body-parser';
import MessagesHandler from './messages-handler.js';
import GITHUB_MESSAGE_TYPES from './github-message-types';
import { readState } from './log';

export default class BuildBot {
    constructor (botUsername, botOauthToken, webhooksPort) {
        this.bot = {
            name:  botUsername,
            token: botOauthToken
        };

        this.port = webhooksPort;

        this.messagesHandler = new MessagesHandler(this.bot, readState());
        this._runServer();
    }

    _runServer () {
        var app    = express();
        var server = null;

        app.use(bodyParser.json());

        app.post('/payload', (req, res) => {
            var header = req.headers['x-github-event'];
            var type   = '';

            if (header === 'pull_request')
                type = GITHUB_MESSAGE_TYPES.pullRequest;
            else if (header === 'status')
                type = GITHUB_MESSAGE_TYPES.status;
            else
                type = GITHUB_MESSAGE_TYPES.default;

            this.messagesHandler.handle({
                type: type,
                body: req.body
            });
            res.end();
        });

        server = app.listen(1800, () => {
            var host = server.address().address;
            var port = server.address().port;

            process.stdout.writeLine('Build bot service listening at http://%s:%s', host, port);
        });
    }
}
