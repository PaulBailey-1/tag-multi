"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var width = 1000;
var height = 500;
var playerXSpeed = 8;
var playerYSpeed = 10;
var gravity = 0.4;
var initScore = 60;
var powerUpTime = 10;
var powerUpValue = 10;
var playerSize = 30;
var platformWidth = 300;
var platformHeight = 5;
var powerUpSize = 20;
var platforms = [];
var sockets = [];
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
var Game = /** @class */ (function () {
    function Game() {
        this.players = [];
        this.powerUps = [];
        this.playerCount = 0;
        this.lastScoreTime = 0.0;
        this.powerUpCounter = powerUpTime;
    }
    Game.prototype.addPlayer = function (id) {
        this.playerCount++;
        this.players[id] = new Player(this.playerCount);
        console.log('Player Added');
    };
    Game.prototype.removePlayer = function (id) {
        if (this.players[id].status) {
            this.players[id].dead = true;
            this.updateTagger();
        }
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
        var data = { playerData: {}, powerUpData: [], platformData: [] };
        for (var id in this.players) {
            var player = this.players[id];
            data.playerData[id] = player.toData();
        }
        for (var i = 0; i < this.powerUps.length; i++) {
            data.powerUpData[i] = this.powerUps[i].toData();
        }
        for (var i = 0; i < platforms.length; i++) {
            data.platformData[i] = platforms[i].toData();
        }
        return data;
    };
    Game.prototype.updateTagger = function () {
        var playersAlive = 0;
        for (var id2 in this.players) {
            if (!this.players[id2].dead) {
                playersAlive++;
            }
        }
        var nextIt = _.random(0, playersAlive - 1);
        var count = 0;
        for (var id in this.players) {
            if (!this.players[id].dead) {
                if (count === nextIt) {
                    this.players[id].status = true;
                    break;
                }
                count++;
            }
        }
        var i = 0;
        var winner;
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
    };
    Game.prototype.update = function () {
        for (var id in this.players) {
            this.players[id].update();
        }
        for (var i in this.powerUps) {
            this.powerUps[i].update();
            if (this.powerUps[i].y >= height) {
                this.powerUps.splice(Number(i), 1);
            }
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
                    player1.tag(player2);
                }
            }
        }
        // Powerup check
        for (var i in this.players) {
            for (var j in this.powerUps) {
                if (this.players[i].collide(this.powerUps[j])) {
                    this.players[i].score += powerUpValue;
                    this.powerUps.splice(Number(j), 1);
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
    };
    Game.prototype.restart = function () {
        var _this = this;
        setTimeout(function () {
            for (var id2 in _this.players) {
                _this.players[id2].dead = false;
                _this.players[id2].win = false;
                _this.players[id2].x = _.random(100, width - 100);
                _this.players[id2].y = height - playerSize;
                _this.players[id2].score = initScore;
            }
        }, 3000);
    };
    return Game;
}());
var Graphic = /** @class */ (function () {
    function Graphic() {
    }
    Graphic.prototype.toData = function () {
        return {
            x: this.x,
            y: this.y
        };
    };
    return Graphic;
}());
var Player = /** @class */ (function (_super) {
    __extends(Player, _super);
    function Player(num) {
        var _this = _super.call(this) || this;
        _this.x = _.random(100, 900),
            _this.y = 500 - playerSize;
        _this.xspeed = 0;
        _this.yspeed = 0;
        _this.width = playerSize;
        _this.height = playerSize;
        _this.num = num;
        _this.collision = false;
        _this.grounded = true;
        _this.platformDown = false;
        _this.wall = false;
        _this.wallTimeout = false;
        _this.score = initScore;
        _this.dead = false;
        _this.win = false;
        if (_this.num == 1) {
            _this.status = true;
        }
        else {
            _this.status = false;
        }
        return _this;
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
            if (((bottom1 < bottom2 + Math.abs(_this.yspeed)) && (bottom1 >= top2) && (right1 > left2) && (left1 < right2))) {
                if (_this.platformDown) {
                    _this.yspeed = playerYSpeed;
                }
                else {
                    _this.yspeed = top2 - bottom1;
                    _this.grounded = true;
                    _this.wallTimeout = false;
                }
            }
        });
    };
    Player.prototype.move = function (data) {
        if (data.left && this.x > 0) {
            this.xspeed = -playerXSpeed;
        }
        else {
            this.xspeed = 0;
        }
        if (data.up && this.y > 0 && this.grounded) {
            this.yspeed = -playerYSpeed;
        }
        else if (data.up && this.y > 0 && this.wall) {
            this.yspeed = -playerYSpeed;
            this.wallTimeout = true;
        }
        if (data.right && this.x < 1000 - this.width) {
            this.xspeed = playerXSpeed;
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
        return top1 < bottom2 && bottom1 > top2 && left1 < right2 && right1 > left2;
    };
    Player.prototype.tag = function (other) {
        if (this.collide(other)) {
            if (this.status && !this.collision) {
                this.status = false;
                other.status = true;
                this.collision = true;
                other.collision = true;
            }
            else if (other.status && !other.collision) {
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
}(Graphic));
var Platform = /** @class */ (function (_super) {
    __extends(Platform, _super);
    function Platform(x, y, width, height) {
        var _this = _super.call(this) || this;
        _this.x = x;
        _this.y = y;
        _this.width = width;
        _this.height = height;
        return _this;
    }
    return Platform;
}(Graphic));
var PowerUp = /** @class */ (function (_super) {
    __extends(PowerUp, _super);
    function PowerUp() {
        var _this = _super.call(this) || this;
        _this.x = _.random(100, width - 100);
        _this.y = -powerUpSize;
        _this.width = powerUpSize;
        _this.height = powerUpSize;
        _this.yspeed = 0.0;
        return _this;
    }
    PowerUp.prototype.update = function () {
        this.yspeed += gravity / 3;
        this.y += this.yspeed;
    };
    return PowerUp;
}(Graphic));
platforms.push(new Platform(100, 400, platformWidth, platformHeight));
platforms.push(new Platform(600, 400, platformWidth, platformHeight));
platforms.push(new Platform(350, 300, platformWidth, platformHeight));
platforms.push(new Platform(100, 200, platformWidth, platformHeight));
platforms.push(new Platform(600, 200, platformWidth, platformHeight));
var game = new Game;
game.run();
