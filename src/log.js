import path from 'path';
import fs from 'fs';
import { sync as mkdirp } from 'mkdirp';
import homedir from './utils/homedir';


var LOG_PATH   = path.join(homedir(), '.build-bot-data/log.txt');
var STATE_PATH = path.join(homedir(), '.build-bot-data/state.json');

function init () {
    try {
        var logDirectory = path.dirname(LOG_PATH);

        fs.statSync(logDirectory);
    }
    catch (e) {
        mkdirp(logDirectory);
    }

    try {
        fs.statSync(STATE_PATH);
    }
    catch (e) {
        mkdirp(path.dirname(STATE_PATH));

        saveState(emptyState());
    }
}

export function log (...msgs) {
    var msg = msgs.join(' ');

    process.stdout.write(msg + '\r\n');
    fs.appendFileSync(LOG_PATH, new Date().toLocaleString() + ': ' + msg + '\r\n', 'utf-8');
}

export function saveState (state) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state));
}

export function readState () {
    var state = null;

    try {
        state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    }
    catch (err) {
        state = null;
    }

    return state;
}

export function emptyState () {
    return { openedPullRequests: {} };
}

init();
