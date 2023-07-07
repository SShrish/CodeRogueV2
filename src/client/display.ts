import Util from '../shared/util.js';
import { StateResponse, LevelData } from '../shared/protocol.js';
import PlayerInfo from '../shared/player_info.js';
import Grownups from '../shared/grownups.js';

import Client from './client.js';
import CanvasMap from './canvas_map.js';

declare class Chart {
    constructor(canvas: any, config: any);
    static defaults: any;
    data: any;
    update(): void;
}

const alertLevels = [
    'alert-success',
    'alert-secondary',
    'alert-warning',
    'alert-danger',
];

const numPlayersToRender = 10;
const chartLength = 100;

export default class Display {
    private levelToRender = 1;
    private renderPlayersFrom = 0;
    private numPlayers = 0;
    private renderedPlayers: PlayerInfo[] = [];
    private messageNumber = 0;
    private messagesToShow = 'all';
    map: CanvasMap;
    highlightedPlayer: number | null = null;
    logIsFrozen = false;
    private players: PlayerInfo[] = [];
    private levels: LevelData[] = [];
    private chart!: Chart;

    constructor(
        private readonly client: Client
    ) {
        this.map = new CanvasMap(client);
    }

    async start() {
        await this.map.start();
        this.createPlayerRows();
        this.createPlayerTabColumns();
        this.createPlayerTabChart();
    }

    private element(id: string) {
        return document.getElementById(id) as HTMLElement;
    }

    private getText(id: string) {
        let textField = this.element(id) as HTMLInputElement;
        return textField.value;
    }

    private setText(id:string, text: string) {
        let textField = this.element(id) as HTMLInputElement;
        textField.value = text;
    }

    private classList(id: string) {
        return this.element(id).classList;
    }

    createPlayerRows() {
        let playerTable = this.element('players') as HTMLTableElement;
        for (let i = 0; i < numPlayersToRender; i++) {
            let row = playerTable.insertRow();
            row.classList.add('invisible');
            for (let j = 0; j < 6; j++) {
                row.insertCell();
            }
            row.onclick = () => this.highlightPlayer(i);
        }
    }

    createPlayerTabColumns() {
        let table = this.element('player-stats') as HTMLTableElement;
        let targetLength = table.rows[0].cells.length;
        for (let i = 1; i < table.rows.length; i++) {
            let row = table.rows[i];
            while (row.cells.length < targetLength) {
                let cell = row.insertCell(-1);
                cell.classList.add('table-col');
            }
        }
    }

    createPlayerTabChart() {
        let labels = ['cur'];
        for (let i = 1; i < chartLength; i++) {
            labels.push(`cur - ${i * 5}`);
        }
        Chart.defaults.color = 'black';
        this.chart = new Chart(this.element('player-chart'), {
            type: 'line',
            options: {
                scales: { y: { beginAtZero: true, suggestedMax: 2000 }},
                animation: false,
            },
            data: {
                datasets: [{
                    label: 'Score in five-minute intervals',
                    borderColor: '#808080',
                    backgroundColor: '#e0e0e0',
                    borderWidth: 1,
                    pointStyle: false,
                    fill: true,
                    labels: labels,
                    data: new Array(chartLength).fill(0),
                }],
            },
        });
    }

    setState(state: StateResponse) {
        this.players = [];
        for (let playerData of state.players) {
            if (playerData) this.players[playerData.id] = new PlayerInfo(playerData);
        }
        this.levels = state.levels;
        this.render();
    }

    render() {
        if (this.highlightedPlayer) {
            let playerLevel = this.players[this.highlightedPlayer].levelNumber;
            if (playerLevel != 0) this.levelToRender = playerLevel;
        }
        let level = this.levels[this.levelToRender];
        this.renderTitle(level.name);
        this.map.render(level, this.players);
        this.renderPlayers(this.players);
        if (this.isShowing('player-tab')) {
            this.renderPlayerTab();
        }
    }

    renderTitle(name: string) {
        let span = this.element('level');
        span.removeChild(span.firstChild as Node);
        span.appendChild(document.createTextNode(this.levelToRender.toString()));
        span = this.element('level-name');
        span.removeChild(span.firstChild as Node);
        span.appendChild(document.createTextNode(name));
    }

    renderPlayers(players: PlayerInfo[]) {
        this.renderedPlayers = this.findPlayersToRender(players);
        let playerTable = this.element('players') as HTMLTableElement;
        for (let i = 0; i < numPlayersToRender; i++) {
            let row = playerTable.rows[i + 1];
            if (i < this.renderedPlayers.length) {
                row.classList.remove('invisible');
                let player = this.renderedPlayers[i];
                row.cells[0].innerHTML = player.rank.toString();
                row.cells[1].innerHTML = player.totalScore.toString();
                row.cells[2].innerHTML = player.levelNumber.toString();
                row.cells[3].innerHTML = player.textHandle;
                row.cells[4].innerHTML = player.kills.reduce((a, b) => a + b, 0).toString();
                row.cells[5].innerHTML = player.deaths.reduce((a, b) => a + b, 0).toString();
                if (player.id == this.highlightedPlayer) {
                    row.classList.add('highlighted');
                } else {
                    row.classList.remove('highlighted');
                }
            } else {
                row.classList.add('invisible');
            }
        }
    }

    findPlayersToRender(players: PlayerInfo[]) {
        let result = [];
        let topPlayers = players.filter(p => p);
        if (this.client.credentials.playerId) {
            result.push(players[this.client.credentials.playerId]);
        }
        if (!Grownups.includes(this.client.credentials.playerId)) {
            topPlayers.forEach(p => {
                if (!Grownups.includes(p.id)) return;
                p.score = new Array(p.score.length).fill(0);
            });
        }
        if (this.highlightedPlayer && this.highlightedPlayer != this.client.credentials.playerId) {
            result.push(players[this.highlightedPlayer]);
        }
        this.numPlayers = topPlayers.length;
        topPlayers.sort((a, b) => b.totalScore - a.totalScore);
        topPlayers.forEach((p, i) => p.rank = i + 1);
        for (let i = this.renderPlayersFrom; i < topPlayers.length; i++) {
            let player = topPlayers[i];
            if (result.some(p => p.id == player.id)) continue;
            result.push(player);
            if (result.length >= numPlayersToRender) break;
        }
        result.sort((a, b) => a.rank - b.rank);
        return result;
    }

    highlightPlayer(index: number) {
        this.toggleHighlight(this.renderedPlayers[index].id);
    }

    highlightTile(x: number, y: number) {
        this.toggleHighlight(this.map.getPlayerAt(x, y));
    }

    toggleHighlight(playerId: number | null) {
        if (!playerId) return;
        if (playerId == this.highlightedPlayer) {
            this.highlightedPlayer = null;
        } else {
            this.highlightedPlayer = playerId;
        }
        this.render();
    }

    switchLevel(dir: number) {
        this.highlightedPlayer = null;
        this.levelToRender += dir;
        this.levelToRender = Math.max(this.levelToRender, 1);
        this.levelToRender = Math.min(this.levelToRender, this.levels.length - 1);
        this.render();
    }

    showPlayers(dir: number) {
        let step = numPlayersToRender - 2;
        if (dir == 0) this.renderPlayersFrom = 0;
        this.renderPlayersFrom += step * dir;
        this.renderPlayersFrom = Math.max(this.renderPlayersFrom, 0);
        this.renderPlayersFrom = Math.min(this.renderPlayersFrom, this.numPlayers - step);
        this.render();
    }

    findHandle() {
        if (!this.players) return;
        let handle = this.getText('handle');
        let player = this.players.find(p => p && p.textHandle == handle);
        if (player) {
            this.highlightedPlayer = player.id;
            this.render();
            this.say(`Highlighted ${handle}.`, 0);
        } else {
            this.say(`Can't find ${handle}.`, 3);
        }
    }

    setCode(code: string) {
        this.client.editor.code = code;
    }

    getCode() {
        return this.client.editor.code;
    }

    isShowing(tab: string) {
        return this.classList(tab).contains('active');
    }

    setLog(log: string) {
        this.setText('log-text', log);
    }

    toggleFreeze() {
        let button = this.classList('freeze').toggle('active');
        this.logIsFrozen = !this.logIsFrozen;
    }

    renderPlayerTab() {
        let playerIdToRender = this.highlightedPlayer?? this.client.credentials.playerId;
        if (!playerIdToRender) return;
        let playerInfo = this.players[playerIdToRender];
        this.renderPlayerInfo(playerInfo);
        this.renderPlayerStats(playerInfo);
        this.renderPlayerChart(playerInfo);
    }

    renderPlayerInfo(playerInfo: PlayerInfo) {
        let infoTable = this.element('player-info') as HTMLTableElement;
        [
            playerInfo.levelNumber.toString(),
            Util.stringify(playerInfo.pos),
            playerInfo.dir.toString(),
            playerInfo.idle.toString(),
            playerInfo.offenses.toString(),
            playerInfo.jailtime.toString(),
            playerInfo.id.toString(),
            playerInfo.handle.toString(),
        ]
        .forEach((x, i) => infoTable.rows[i].cells[1].innerHTML = x);
    }

    renderPlayerStats(playerInfo: PlayerInfo) {
        let statsTable = this.element('player-stats') as HTMLTableElement;
        let cumulative = [playerInfo.timeSpent[0]];
        for (let i = 1; i < playerInfo.timeSpent.length; i++) {
            cumulative[i] = cumulative[i - 1] + playerInfo.timeSpent[i];
        }
        let values = [
            playerInfo.timeSpent.map(x => this.shorten(x)),
            playerInfo.timesCompleted,
            playerInfo.score.map((x, i) => this.renderRatio(x, playerInfo.timeSpent[i])),
            playerInfo.timesCompleted.map((x, i) => this.renderRatio(playerInfo.timeSpent[i], x)),
            playerInfo.timesCompleted.map((x, i) => this.renderRatio(cumulative[i], x)),
        ];
        for (let i = 0; i < values.length; i++) {
            let row = statsTable.rows[i + 1];
            for (let j = 0; j < values[i].length; j++) {
                row.cells[j + 1].innerHTML = Util.stringify(values[i][j]);
            }
        }
        if (playerInfo.timesCompleted[2] >= 10) {
            let symbol = this.isGoalMet(playerInfo)? '&#x2713': 'x'
            statsTable.rows[6].cells[2].innerHTML = symbol;
        }
    }

    shorten(num: number) {
        if (num < 1000) return num;
        if (num < 1000000) return (num / 1000).toFixed(1) + 'k';
        return (num / 1000000).toFixed(1) + 'm';
    }

    renderRatio(x: number, y: number) {
        let value = (y > 0? x / y: 0).toFixed(1)
        return this.shorten(Number(value));
    }

    printPassed() {
        let passed = this.players.filter(p => p && this.isGoalMet(p));
        console.log(passed.map(p => p.id).join(' '));
    }

    isGoalMet(playerInfo: PlayerInfo) {
        let timesCompleted = playerInfo.timesCompleted[2];
        if (timesCompleted < 10) return false;
        let totalTime = 0;
        for (let l = 0; l <= 2; l++) {
            totalTime += playerInfo.timeSpent[l];
        }
        return totalTime / timesCompleted < 300;
    }

    renderPlayerChart(playerInfo: PlayerInfo) {
        this.chart.data.datasets[0].data = playerInfo.chartData;
        this.chart.update();
    }

    showAll() {
        this.classList('show-all').add('active');
        this.classList('show-latest').remove('active');
        this.classList('show-filtered').remove('active');
        this.messagesToShow = 'all';
    }

    showLatest() {
        this.classList('show-all').remove('active');
        this.classList('show-latest').add('active');
        this.classList('show-filtered').remove('active');
        this.messagesToShow = 'latest';
    }

    showFiltered() {
        this.classList('show-all').remove('active');
        this.classList('show-latest').remove('active');
        this.classList('show-filtered').add('active');
        this.messagesToShow = 'filtered';
    }

    filterLog(log: string) {
        let lines = log.split('\n');
        let filter = '';
        if (this.messagesToShow == 'latest' && lines.length > 0) {
            filter = lines[lines.length - 1].slice(0, 8);
        }
        if (this.messagesToShow == 'filtered') {
            filter = this.getText('filter-text');
        }
        lines = lines.filter(line => line.includes(filter));
        lines.reverse();
        return lines.join('\n');
    }

    onMouseEnter() {
        this.classList('coords').add('show');
    }

    onMouseMove(x: number, y: number) {
        let [col, row] = this.map.getPosAt(x, y);
        this.setText('x-coord', col.toString());
        this.setText('y-coord', row.toString());
    }

    onMouseLeave() {
        this.classList('coords').remove('show');
    }

    showLoggedIn() {
        this.classList('login-form').add('d-none');
        this.classList('logout-form').remove('d-none');
        this.setText('user-handle', this.client.credentials.textHandle as string);
    }

    showLoggedOut() {
        this.classList('login-form').remove('d-none');
        this.classList('logout-form').add('d-none');
    }

    switchTab(dir: number) {
        let navLinks = document.getElementsByClassName('nav-link') as HTMLCollectionOf<HTMLAnchorElement>;
        let activeIndex = 0;
        for (let i = 0; i < navLinks.length; i++) {
            if (navLinks[i].classList.contains('active')) {
                activeIndex = i;
            }
        }
        let newIndex = (activeIndex + dir + navLinks.length) % navLinks.length;
        navLinks[newIndex].click();
    }

    say(message: string, level: number) {
        const n = ++this.messageNumber;
        const div = this.element('message');
        div.innerHTML = message;
        for (let level of alertLevels) {
            div.classList.remove(level);
        }
        div.classList.add(alertLevels[level]);
        div.classList.add('show');
        setTimeout(() => {
            if (this.messageNumber != n) return;
            div.classList.remove('show');
        }, 3000);
    }
}