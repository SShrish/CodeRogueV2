import CircularLog from './circular_log.js';

export default class PlayerInfo {
    constructor(player) {
        this.player = player;
        this.action = undefined;
        this.level = undefined;
        this.log = new CircularLog(1000);
    }

    get id() {
        return this.player.id;
    }

    log(text) {
        this.log.write(text);
    }
}