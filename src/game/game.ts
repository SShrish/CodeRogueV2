import util from 'util';
import { VM, VMScript } from 'vm2';

import Handles from '../shared/handles.js';

import Server from '../server/server.js';

import JailLevel from '../levels/jail_level.js';
import IntroLevel from '../levels/intro_level.js';
import BlockLevel from '../levels/block_level.js';
import CaveLevel from '../levels/cave_level.js';
import HunterLevel from '../levels/hunter_level.js';

import Level from './level.js';
import Player, { InfoPlus } from './player.js';
import Preamble from './preamble.js';
import VmEnvironment from './vm_environment.js';

const jailtimes = [10, 60, 600, 3600];
const chartUpdateInterval = 5 * 60 * 1000; // 5 minutes

export default class Game {
    readonly levels: Level[];
    players: Player[] = [];
    private playerHandles: Set<number> = new Set();
    private lastChartUpdate = Date.now();
    private busy = false;

    constructor(
        private readonly server: Server
    ) {
        this.levels = [
            JailLevel,
            IntroLevel,
            BlockLevel,
            CaveLevel,
            HunterLevel,
        ]
        .map((levelClass, i) => new levelClass(server, i));
    }

    async start() {
        await this.loadPlayers();
        this.busy = false;
        setInterval(() => this.tick(), 1000);
    }

    private async loadPlayers() {
        for (let dbEntry of await this.server.db.loadPlayers()) {
            this.addPlayer(dbEntry as InfoPlus);
        }
    }

    createNewHandle() {
        const maxHandle = Handles.getMaxHandle();
        if (this.playerHandles.size >= maxHandle) {
            console.log('Max handles exceeded!');
            return 0;
        }
        while (true) {
            let handle = Math.floor(Math.random() * maxHandle);
            if (!this.playerHandles.has(handle)) {
                return handle;
            }
        }
    }

    addPlayer(dbEntry: InfoPlus) {
        let player = new Player(dbEntry as InfoPlus);
        this.players[player.id] = player;
        this.playerHandles.add(player.handle);
        this.levels[1].spawn(player);
    }

    private async tick() {
        if (this.busy) {
            console.log('Missed a tick.');
            return;
        }
        this.busy = true;
        await this.doTickActions();
        this.busy = false;
    }

    private async doTickActions() {
        if (Date.now() - this.lastChartUpdate > chartUpdateInterval) {
            for (let player of this.players) {
                if (player) player.addChartInterval();
            }
            this.lastChartUpdate += chartUpdateInterval;
        }
        for (let player of this.players) {
            if (player) await this.doPlayerAction(player);
        }
        for (let level of this.levels) {
            level.doLevelAction();
        }
    }

    private async doPlayerAction(player: Player) {
        if (player.isInJail) this.updateJailTime(player);
        if (player.isInJail) return;
        await this.ensureAction(player);
        if (player.isInJail) return;
        this.takeAction(player);
        if (player.isInJail) return;
        this.updateIdleTime(player);
    }

    private updateJailTime(player: Player) {
        if (--player.jailtime == 0) {
            this.respawn(player);
            return;
        }
        player.incrementTimeSpent();
        player.log.write(`In jail for ${player.jailtime} more turns.`);
    }

    private async ensureAction(player: Player) {
        if (player.action) return;
        try {
            player.action = await this.createPlayerAction(player);
        } catch (e) {
            player.log.write('Failed to compile script!');
            player.log.write(this.trimError(e));
            this.punish(player);
        }
    }

    private async createPlayerAction(player: Player) {
        const env = new VmEnvironment(this, player);
        const vm = new VM({
            timeout: 200,
            sandbox: env.sandbox,
            eval: false,
            wasm: false,
            allowAsync: false,
        });
        const code = await this.server.repositories.readCode(player.id);
        const script = new VMScript(Preamble.code + code);
        return () => vm.run(script);
    }

    private takeAction(player: Player) {
        player.incrementTimeSpent();
        player.idle++;
        player.turns = 1;
        try {
            let action = player.action as (() => void);
            action();
        } catch (e: any) {
            if (e.code == 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
                player.log.write('Script execution timed out!');
            } else {
                player.log.write(this.trimError(e));
            }
            this.punish(player);
        }
    }

    private trimError(e: unknown) {
        let lines = util.inspect(e).split('\n');
        let i = lines.findIndex(l =>
            l.includes('at Script.runInContext') ||
            l.includes('at VMScript._compile')
        );
        if (i > 0) lines = lines.slice(0, i);
        lines.reverse();
        return lines.join('\n');
    }

    private punish(player: Player) {
        player.offenses++;
        const maxJailtime = jailtimes[Math.min(player.offenses, jailtimes.length) - 1];
        player.jailtime = Math.floor(Math.random() * maxJailtime);
        this.moveToLevel(player, 0);
    }

    private updateIdleTime(player: Player) {
        if (player.idle == 0) player.offenses = 0;
        if (player.idle > this.levels[player.levelNumber].maxIdleTime) {
            player.log.write('Idle timeout!');
            this.punish(player);
            player.idle = 0;
        }
    }

    respawn(player: Player) {
        player.dontScore = false;
        this.moveToLevel(player, 1);
    }

    respawnAt(player: Player, level: Level, pos: [number, number], dir: number) {
        player.dontScore = true;
        this.moveToLevel(player, level.levelNumber);
    }

    exitPlayer(player: Player) {
        player.incrementTimesCompleted();
        let newLevelNumber = player.levelNumber + 1;
        if (newLevelNumber == this.levels.length || player.dontScore) {
            newLevelNumber = 1;
        }
        this.moveToLevel(player, newLevelNumber);
    }

    moveToLevel(player: Player, levelNumber: number) {
        this.levels[player.levelNumber].removePlayer(player);
        this.levels[levelNumber].spawn(player);
    }

    getState() {
        return {
            players: this.players.map(player => player ? player.getState() : null),
            levels: this.levels.map(level => level.getState()),
        };
    }
}
