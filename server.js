"use strict";
exports.__esModule = true;
// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
var _ = require('lodash');
var app = express();
var server = http.Server(app);
var io = socketIO(server);
app.set('port', 5000);
app.use('/static', express.static(__dirname + '/static'));
// Routing
app.get('/', function (request, response) {
    response.sendFile(path.join(__dirname, 'index.html'));
});
var gravity = 0.4;
var initScore = 60;
var platforms = [
    new Platform(100, 400, 300, 5),
    new Platform(600, 400, 300, 5),
    new Platform(350, 300, 300, 5),
    new Platform(100, 200, 300, 5),
    new Platform(600, 200, 300, 5)
];
var sockets = {};
// Starts the server.
server.listen(5000, function () {
    console.log('Starting server on port 5000');
});
io.on('connection', function (socket) {
    socket.on('new player', function () {
        sockets[socket.id] = game;
        game.addPlayer(socket.id);
    });
    socket.on('movement', function (data) {
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
var Game = /** @class */ (function () {
    function Game() {
        this.players = [];
        this.playerCount = 0;
    }
    Game.prototype.addPlayer = function (id) {
        this.players[id] = new Player(this.players.length + 1);
        console.log('Player Added');
    };
    Game.prototype.removePlayer = function (id) {
        delete this.players[id];
        this.playerCount--;
        console.log('Player Disconnected');
    };
    Game.prototype.movePlayer = function (id, data) {
        var player = this.players[id];
        if (player !== undefined) {
            player.move(data);
        }
    };
    Game.prototype.run = function () {
        this.lastScoreTime = (new Date()).getTime();
        setInterval(function (game) {
            game.update();
            io.sockets.emit('state', game.getData());
        }, 1000 / 60, this);
    };
    Game.prototype.getData = function () {
        var data = { playerData: {}, platformData: platforms };
        for (var id in this.players) {
            var player = this.players[id];
            data.playerData[id] = player.toData();
        }
        return data;
    };
    Game.prototype.update = function () {
        for (var id in this.players) {
            this.players[id].update();
        }
        // Tag check
        for (var firstId in this.players) {
            for (var secondId in this.players) {
                if (firstId != secondId) {
                    var player1 = this.players[firstId];
                    var player2 = this.players[secondId];
                    if (player1.dead || player2.dead) {
                        continue;
                    }
                    player1.collide(player2);
                }
            }
        }
        // Scoring
        var currentTime = (new Date()).getTime();
        var timeDifference = currentTime - this.lastScoreTime;
        if (timeDifference >= 1000) {
            for (var id in this.players) {
                var player = this.players[id];
                if (player.scoring(this.playerCount)) {
                    for (var id2 in this.players) {
                        if (!this.players[id2].dead) {
                            this.players[id2].status = true;
                            this.players[id2].color = 'red';
                            break;
                        }
                    }
                    var i = 0;
                    var winner = void 0;
                    for (var id2 in this.players) {
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
    };
    Game.prototype.restart = function () {
        var _this = this;
        setTimeout(function () {
            for (var id2 in _this.players) {
                _this.players[id2].dead = false;
                _this.players[id2].win = false;
                _this.players[id2].x = _.random(100, 900);
                _this.players[id2].y = 500 - 30;
                _this.players[id2].score = initScore;
            }
        }, 3000);
    };
    return Game;
}());
var Player = /** @class */ (function () {
    function Player(num) {
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
        this.win = false;
        if (this.num == 1) {
            this.status = true;
        }
        else {
            this.status = false;
        }
    }
    Player.prototype.update = function () {
        var _this = this;
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
        }
        else {
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
        platforms.forEach(function (platform, i) {
            var left1 = _this.x;
            var right1 = _this.x + (_this.width);
            // let top1 = this.y;
            var bottom1 = _this.y + (_this.height);
            var left2 = platform.x;
            var right2 = platform.x + (platform.width);
            var top2 = platform.y;
            var bottom2 = platform.y + (platform.height);
            if (((bottom1 < bottom2 + Math.abs(_this.yspeed)) && (bottom1 >= top2) && (right1 > left2) && (left1 < right2)) && !_this.platformDown) {
                _this.yspeed = top2 - bottom1;
                _this.grounded = true;
                _this.wallTimeout = false;
            }
        });
    };
    Player.prototype.move = function (data) {
        if (data.left && this.x > 0) {
            this.xspeed = -8;
        }
        else {
            this.xspeed = 0;
        }
        if (data.up && this.y > 0 && this.grounded) {
            this.yspeed = -10;
        }
        else if (data.up && this.y > 0 && this.wall) {
            this.yspeed = -10;
            this.wallTimeout = true;
        }
        if (data.right && this.x < 1000 - this.width) {
            this.xspeed = 8;
        }
        if (data.down && this.y < 500 - this.height) {
            this.platformDown = true;
        }
        else {
            this.platformDown = false;
        }
    };
    Player.prototype.collide = function (other) {
        var left1 = this.x;
        var right1 = this.x + (this.width);
        var top1 = this.y;
        var bottom1 = this.y + (this.height);
        var left2 = other.x;
        var right2 = other.x + (other.width);
        var top2 = other.y;
        var bottom2 = other.y + (other.height);
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
            }
            else if (other.status && !other.collision) {
                // console.log('collision');
                other.status = false;
                this.status = true;
                other.collision = true;
                this.collision = true;
            }
        }
        else if (this.collision && other.collision) {
            this.collision = false;
            other.collision = false;
        }
    };
    Player.prototype.scoring = function (playerCount) {
        if (this.status && playerCount > 1 && !this.dead && !this.win) {
            this.score--;
            if (this.score == 0) {
                this.dead = true;
                this.status = false;
                return true;
            }
        }
    };
    Player.prototype.toData = function () {
        var color = this.status ? "red" : "green";
        return {
            x: this.x,
            y: this.y,
            color: color,
            num: this.num,
            score: this.score,
            dead: this.dead,
            win: this.win
        };
    };
    return Player;
}());
// class PowerUp {
//     x: number;
//     y: number;
//     yspeed: number;
//     constructor(x: number) {
//         this.x = x;
//     }
//     update
// }
var game = new Game;
game.run();
