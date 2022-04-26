import { Socket } from "socket.io";

// Dependencies
let express = require('express');
let http = require('http');
let path = require('path');
let socketIO = require('socket.io');
let _ = require('lodash');
let app = express();
let server = http.Server(app);
let io = socketIO(server);

app.set('port', 5000);
app.use('/static', express.static(__dirname + '/static'));

// Routing
app.get('/', function (request, response) {
    response.sendFile(path.join(__dirname, 'index.html'));
});

interface ClientData {
    up: boolean,
    down: boolean,
    left: boolean,
    right: boolean,
}

const width = 1000;
const height = 500;

const playerXSpeed = 8;
const playerYSpeed = 10;

const gravity = 0.4;
const initScore = 60;
const powerUpTime = 10;
const powerUpValue = 10;

const playerSize = 30;
const platformWidth = 300;
const platformHeight = 5;
const powerUpSize = 20;

const platforms = [];

let sockets = [];

// Starts the server.
server.listen(5000, function () {
    console.log('Starting server on port 5000');
});

io.on('connection', function (socket: Socket) {
    socket.on('new player', function () {
        sockets[socket.id] = game;
        game.addPlayer(socket.id);
    });

    socket.on('movement', function (data: ClientData) {
        if (sockets[socket.id] !== undefined) {
            sockets[socket.id].movePlayer(socket.id, data);
        }
    });

    socket.on('disconnect', function () {
        if (sockets[socket.id] !== undefined) {
            sockets[socket.id].removePlayer(socket.id);
        }
    });
});

class Game {

    private players = [];
    private powerUps = [];
    
    private playerCount: number;
    private lastScoreTime: number;
    private powerUpCounter: number;

    constructor() {
        this.playerCount = 0;
        this.lastScoreTime = 0.0;
        this.powerUpCounter = powerUpTime;
    }

    addPlayer(id: string) {
        this.playerCount++;
        this.players[id] = new Player(this.playerCount);
        console.log('Player Added');
    }

    removePlayer(id: string) {
        if (this.players[id].status) {
            this.players[id].dead = true;
            this.updateTagger();
        }
        delete this.players[id];
        this.playerCount--;
        console.log('Player Disconnected');
    }

    movePlayer(id: string, data: ClientData) {
        let player: Player = this.players[id];
        if (player !== undefined) {
            player.move(data)
        }
    }

    run() {
        this.lastScoreTime = (new Date()).getTime();
        setInterval((game: Game) => {

            game.update();

            io.sockets.emit('state', game.getData());
        }, 1000 / 60, this);

    }

    getData() {
        let data = { playerData: {}, powerUpData: [], platformData: []};
        for (let id in this.players) {
            let player: Player = this.players[id];
            data.playerData[id] = player.toData();
        }
        for (let i = 0; i < this.powerUps.length; i++) {
            data.powerUpData[i] = this.powerUps[i].toData();
        }

        for (let i = 0; i < platforms.length; i++) {
            data.platformData[i] = platforms[i].toData();
        }
        return data;
    }

    updateTagger() {
        let playersAlive = 0;
        for (let id2 in this.players) {
            if (!this.players[id2].dead) {
                playersAlive++;
            }
        }
        let nextIt = _.random(0, playersAlive - 1)
        let count = 0;
        for (let id in this.players) {
            if (!this.players[id].dead) {
                if (count === nextIt) {
                    this.players[id].status = true;
                    break;
                }
                count++;
            }
        }

        let i = 0
        let winner: Player;
        for (let id2 in this.players) {
            if (!this.players[id2].dead) {
                i++;
                winner = this.players[id2];
            }
        }
        if (i == 1) {
            winner.win = true;
            this.restart();
        }
    }

    update() {
        for (let id in this.players) {
            this.players[id].update();
        }

        for (let i in this.powerUps) {
            this.powerUps[i].update();
            if (this.powerUps[i].y >= height) {
                this.powerUps.splice(Number(i), 1);
            }
        }
    
        // Tag check
        for (let firstId in this.players) {
            for (let secondId in this.players) {
                if (firstId != secondId) {
                    let player1: Player = this.players[firstId];
                    let player2: Player = this.players[secondId];
    
                    if (player1.dead || player2.dead) {
                        continue;
                    }
    
                    player1.tag(player2);
                }
            }
        }

        // Powerup check
        for (let i in this.players) {
            for (let j in this.powerUps) {
                if (this.players[i].collide(this.powerUps[j])) {
                    this.players[i].score += powerUpValue;
                    this.powerUps.splice(Number(j), 1);
                }
            }
        }
    
        // Scoring
        let currentTime = (new Date()).getTime();
        let timeDifference = currentTime - this.lastScoreTime;
        if (timeDifference >= 1000) {
            for (let id in this.players) {
                let player = this.players[id];
                if (player.scoring(this.playerCount)) {
                    this.updateTagger();
                }
            }
            
            // Power ups
            this.powerUpCounter--;
            if (_.random(0, this.powerUpCounter) == 0) {
                this.powerUps.push(new PowerUp());
                this.powerUpCounter = powerUpTime;
            }

            this.lastScoreTime = currentTime;
        }
    }

    restart() {
        setTimeout(() => {
            for (let id2 in this.players) {
                this.players[id2].dead = false;
                this.players[id2].win = false;
                this.players[id2].x = _.random(100, width - 100);
                this.players[id2].y = height - playerSize;
                this.players[id2].score = initScore
            }
        }, 3000);
    }
}

class Graphic {
    public x: number;
    public y: number;
    public width: number;
    public height: number;

    toData() {
        return {
            x: this.x,
            y: this.y,
        }
    }
}

class Player extends Graphic {

    private xspeed: number;
    private yspeed: number;
    private num: number;
    private score: number;

    private collision: boolean;
    private grounded: boolean;
    private platformDown: boolean;
    private wall: boolean;
    private wallTimeout: boolean;
    public dead: boolean;
    public win: boolean;
    private status: boolean;

    constructor(num: number) {
        super();
        this.x = _.random(100, 900),
        this.y = 500 - playerSize;
        this.xspeed = 0;
        this.yspeed = 0;
        this.width = playerSize;
        this.height = playerSize;
        this.num = num;
        this.collision = false;
        this.grounded = true;
        this.platformDown = false;
        this.wall = false;
        this.wallTimeout = false;
        this.score = initScore;
        this.dead = false;
        this.win = false

        if (this.num == 1) {
            this.status = true;
        } else {
            this.status = false;
        }
    }
    

    update() {

        // Boundries
        if (this.y > 500 - this.height) {
            this.yspeed = 0;
            this.y = 500 - this.height;
        }
        if (this.y < 0) {
            this.yspeed = 0;
            this.y = 0;
        }
        if (this.x > 1000 - this.width) {
            this.xspeed = 0;
            this.x = 1000 - this.width;
        }
        if (this.x < 0) {
            this.xspeed = 0;
            this.x = 0;
        }


        if ((this.x == 0 || this.x == 1000 - this.width) && !this.wallTimeout) {
            this.wall = true;
        } else {
            this.wall = false;
        }

        // gravity
        if (!this.grounded) {
            this.yspeed += gravity;
        }

        this.x += this.xspeed;
        this.y += this.yspeed;


        // grounded
        this.grounded = false;
        if (this.y >= 500 - this.height) {
            this.grounded = true;
            this.wallTimeout = false;
        }
        platforms.forEach((platform, i) => {
            let left1 = this.x;
            let right1 = this.x + (this.width);
            // let top1 = this.y;
            let bottom1 = this.y + (this.height);
            let left2 = platform.x;
            let right2 = platform.x + (platform.width);
            let top2 = platform.y;
            let bottom2 = platform.y + (platform.height);

            if (((bottom1 < bottom2 + Math.abs(this.yspeed)) && (bottom1 >= top2) && (right1 > left2) && (left1 < right2))) {
                if (this.platformDown) {
                    this.yspeed = playerYSpeed;
                } else {
                    this.yspeed = top2 - bottom1;
                    this.grounded = true;
                    this.wallTimeout = false;
                }
            }
        });
    }

    move(data: ClientData) {
        if (data.left && this.x > 0) {
            this.xspeed = -playerXSpeed;
        } else {
            this.xspeed = 0;
        }
        if (data.up && this.y > 0 && this.grounded) {
            this.yspeed = -playerYSpeed;
        } else if (data.up && this.y > 0 && this.wall) {
            this.yspeed = -playerYSpeed;
            this.wallTimeout = true;
        }
        if (data.right && this.x < 1000 - this.width) {
            this.xspeed = playerXSpeed;
        }
        if (data.down && this.y < 500 - this.height) {
            this.platformDown = true;
        } else {
            this.platformDown = false;
        }
    }

    collide(other: Graphic) {

        let left1 = this.x;
        let right1 = this.x + (this.width);
        let top1 = this.y;
        let bottom1 = this.y + (this.height);
        let left2 = other.x;
        let right2 = other.x + (other.width);
        let top2 = other.y;
        let bottom2 = other.y + (other.height);

        return top1 < bottom2 && bottom1 > top2 && left1 < right2 && right1 > left2;
    }

    tag(other: Player) {
        if (this.collide(other)) {
            if (this.status && !this.collision) {
                this.status = false;
                other.status = true;
                this.collision = true;
                other.collision = true;
            } else if (other.status && !other.collision) {
                other.status = false;
                this.status = true;
                other.collision = true;
                this.collision = true;
            }
        } else if (this.collision && other.collision) {
            this.collision = false;
            other.collision = false;
        }
    }

    scoring(playerCount: number) {
        if (this.status && playerCount > 1 && !this.dead && !this.win) {
            this.score--;
            if (this.score == 0) {
                this.dead = true;
                this.status = false;
                return true;
            }
        }
    }

    toData() {
        let color = this.status ? "red" : "green";
        return {
            x: this.x,
            y: this.y,
            color: color,
            num: this.num,
            score: this.score,
            dead: this.dead,
            win: this.win
        }
    }
}

class Platform extends Graphic {

    constructor(x, y, width, height) {
        super();
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
}

class PowerUp extends Graphic {

    private yspeed: number;

    constructor() {
        super();
        this.x = _.random(100, width - 100);
        this.y = -powerUpSize;
        this.width = powerUpSize;
        this.height = powerUpSize;
        this.yspeed = 0.0;
    }

    update() {
        this.yspeed += gravity / 3;
        this.y += this.yspeed;
    }
}

platforms.push(new Platform(100, 400, platformWidth, platformHeight));
platforms.push(new Platform(600, 400, platformWidth, platformHeight));
platforms.push(new Platform(350, 300, platformWidth, platformHeight));
platforms.push(new Platform(100, 200, platformWidth, platformHeight));
platforms.push(new Platform(600, 200, platformWidth, platformHeight));

let game = new Game;
game.run();