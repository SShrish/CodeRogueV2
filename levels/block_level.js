import Level from '../game/level.js';

import JigglyBlock from './jiggly_block.js';

export default class BlockLevel extends Level {
    constructor(server) {
        super(server);
        this.hills = [];
        for (let row of [5, 15, 25, 35]) {
            for (let col of [25, 40, 55]) {
                let hill = new Hill(this, [col, row]);
                this.hills.push(hill);
                hill.drawWalls();
            }
        }
    }

    get name() { return 'Rolling Hills'; }
    get spawnTargetPos() { return super.exitPos; }
    get exitPos() { return super.spawnTargetPos; }
    get exitScore() { return 200; }
    get bumpScore() { return -1; }

    doLevelAction() {
        for (let hill of this.hills) {
            hill.eraseWalls();
            hill.jiggle();
            hill.drawWalls();
        }
    }
}

class Hill extends JigglyBlock {
    isValidMove(pos0, size0, pos1, size1) {
        let valid = true;
        this.forEach(pos1, size1, p => valid &= this.level.map.canEnter(p));
        return valid;
    }
}
