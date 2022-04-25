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

const gravity = 0.4;
const initScore = 60;

const platforms = [
    new Platform(100, 400, 300, 5),
    new Platform(600, 400, 300, 5),
    new Platform(350, 300, 300, 5),
    new Platform(100, 200, 300, 5),
    new Platform(600, 200, 300, 5)
];

let sockets = {};

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

function Platform(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
}

class Game {

    private players = [];
    private playerCount: number = 0;
    private lastScoreTime: number;

    constructor() {}

    addPlayer(id: string) {
        this.players[id] = new Player(this.players.length + 1);
        console.log('Player Added');
    }

    removePlayer(id: string) {
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
        let data = { playerData: {}, platformData: platforms };
        for (let id in this.players) {
            let player: Player = this.players[id];
            data.playerData[id] = player.toData();
        }
        return data;
    }

    update() {
        for (let id in this.players) {
            this.players[id].update();
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
    
                    player1.collide(player2);
                }
            }
        }
    
        // Scoring
        let currentTime = (new Date()).getTime();
        let timeDifference = currentTime - this.lastScoreTime;
        if (timeDifference >= 1000) {
            for (let id in this.players) {
                let player: Player = this.players[id];
                if (player.scoring(this.playerCount)) {
                    for (let id2 in this.players) {
                        if (!this.players[id2].dead) {
                            this.players[id2].status = true;
                            this.players[id2].color = 'red';
                            break;
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
            }
    
            this.lastScoreTime = currentTime;
        }
    }

    restart() {
        setTimeout(() => {
            for (let id2 in this.players) {
                this.players[id2].dead = false;
                this.players[id2].win = false;
                this.players[id2].x = _.random(100, 900);
                this.players[id2].y = 500 - 30;
                this.players[id2].score = initScore
            }
        }, 3000);
    }
}

class Player {

    private x: number;
    private y: number;
    private xspeed: number;
    private yspeed: number;
    private width: number;
    private height: number;
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
        this.x = _.random(100, 900),
        this.y = 500 - 30;
        this.xspeed = 0;
        this.yspeed = 0;
        this.width = 30;
        this.height = 30;
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

            if (((bottom1 < bottom2 + Math.abs(this.yspeed)) && (bottom1 >= top2) && (right1 > left2) && (left1 < right2)) && !this.platformDown) {
                this.yspeed = top2 - bottom1;
                this.grounded = true;
                this.wallTimeout = false;
            }
        });
    }

    move(data: ClientData) {
        if (data.left && this.x > 0) {
            this.xspeed = -8;
        } else {
            this.xspeed = 0;
        }
        if (data.up && this.y > 0 && this.grounded) {
            this.yspeed = -10;
        } else if (data.up && this.y > 0 && this.wall) {
            this.yspeed = -10;
            this.wallTimeout = true;
        }
        if (data.right && this.x < 1000 - this.width) {
            this.xspeed = 8;
        }
        if (data.down && this.y < 500 - this.height) {
            this.platformDown = true;
        } else {
            this.platformDown = false;
        }
    }

    collide(other: Player) {

        let left1 = this.x;
        let right1 = this.x + (this.width);
        let top1 = this.y;
        let bottom1 = this.y + (this.height);
        let left2 = other.x;
        let right2 = other.x + (other.width);
        let top2 = other.y;
        let bottom2 = other.y + (other.height);

        if (!((bottom1 < top2) || (top1 > bottom2) || (right1 < left2) || (left1 > right2))) {
            // console.log('pair');
            // console.log(this.num, this.status, this.collision);
            // console.log(other.num, other.status, other.collision);
            if (this.status && !this.collision) {
                // console.log('collision');
                this.status = false;
                other.status = true;
                this.collision = true;
                other.collision = true;
            } else if (other.status && !other.collision) {
                // console.log('collision');
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

// class PowerUp {
//     x: number;
//     y: number;
//     yspeed: number;

//     constructor(x: number) {
//         this.x = x;
//     }

//     update
// }

let game = new Game;
game.run();