import path from 'path';
import fs from 'fs';

var LOG_PATH   = path.join(__dirname, '../log.txt');
var STATE_PATH = path.join(__dirname, '../state.json');

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
