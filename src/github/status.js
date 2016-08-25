export default class Status {
    constructor (state, targetUrl, description, context) {
        this.state       = state;
        this.targetUrl   = targetUrl;
        this.description = description;
        this.context     = context;
    }
}

Status.STATE = {
    failure: 'failure',
    pending: 'pending',
    success: 'success'
};
