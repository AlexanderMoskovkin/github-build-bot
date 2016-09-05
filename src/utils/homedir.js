import { homedir as nodeHomedir } from 'os';
import OS from 'os-family';


export default nodeHomedir || () => {
    return process.env[OS.win ? 'USERPROFILE' : 'HOME'];
};
