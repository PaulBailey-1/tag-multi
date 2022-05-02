const playerSize = 30;
const platformWidth = 300;
const platformHeight = 5;
const powerUpSize = 20;

var socket = io();

let canStart = false;
let dead = false;
let newGame = false;

var movement = {
  up: false,
  down: false,
  left: false,
  right: false
}

const clock = 1000 / 60;
let players = [];
let platforms = [];

var canvas = document.getElementById('canvas');
canvas.width = 1000;
canvas.height = 500;
var ctx = canvas.getContext('2d');

document.addEventListener('keydown', function(event) {
  switch (event.keyCode) {
    case 37: // left
      movement.left = true;
      break;
    case 38: // up
      movement.up = true;
      break;
    case 39: // right
      movement.right = true;
      break;
    case 40: // down
      movement.down = true;
      break;
  }
});

document.addEventListener('keyup', function(event) {
  switch (event.keyCode) {
    case 37: // A
      movement.left = false;
      break;
    case 38: // W
      movement.up = false;
      break;
    case 39: // D
      movement.right = false;
      break;
    case 40: // S
      movement.down = false;
      break;
  }
});

socket.emit('new player');

setInterval(function() {
  socket.emit('movement', movement);
}, 100);

setInterval(function() {
  for (let id in players) {
    let player = players[id];
    player.x += player.xSpeed * clock / 1000;
    player.y += player.ySpeed * clock / 1000;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  platforms.forEach((platform) => {
    ctx.fillStyle = "black";
    ctx.fillRect(platform.x, platform.y, platformWidth, platformHeight);
  });

  let scorePos = 50;
  for (let id in players) {
    let player = players[id];
    if (!player.dead) {
      ctx.fillStyle = player.color;
      ctx.fillRect(player.x, player.y, playerSize, playerSize);
      ctx.fillStyle = "black";
  		ctx.font = "30px Arial";
  		ctx.fillText(player.num, player.x + 7, player.y + 25);
      ctx.fillText(player.num + ':' + player.score, scorePos, 50);
      scorePos += 100;
    } else if (id == socket.id) {
      ctx.fillStyle = "black";
  		ctx.font = "100px Arial";
      ctx.fillText("You Lost", 300, 290);
      if (!dead) {
        document.getElementById('button').innerHTML = 'New game';
        dead = true;
      }
    } if (player.win) {
      ctx.fillStyle = "black";
  		ctx.font = "100px Arial";
      ctx.fillText(player.num + " wins!", 300, 150);
      if (!dead) {
        document.getElementById('button').innerHTML = 'New game';
        dead = true;
      }
    }
  }

}, clock);

socket.on('state', function(data) {

  if (platforms.length == 0) {
    data.platformData.forEach( function (platform, i) {
      platforms.push(platform);
    });
  }

  data.powerUpData.forEach(function (powerUp, i) {
    ctx.fillStyle = "orange";
    ctx.fillRect(powerUp.x, powerUp.y, powerUpSize, powerUpSize);
  });

  let playerCount = 0;
  for (var id in data.playerData) {

    playerCount++;
    var player = data.playerData[id];
    players[id] = player;

    if (!player.dead) {
      
    } else if (id == socket.id) {
      ctx.fillStyle = "black";
  		ctx.font = "100px Arial";
      ctx.fillText("You Lost", 300, 290);
      if (!dead) {
        document.getElementById('button').innerHTML = 'New game';
        dead = true;
      }
    } if (player.win) {
      ctx.fillStyle = "black";
  		ctx.font = "100px Arial";
      ctx.fillText(player.num + " wins!", 300, 150);
      if (!dead) {
        document.getElementById('button').innerHTML = 'New game';
        dead = true;
      }
    }
  }
  if (playerCount > 1) {
    canStart = true;
    document.getElementById('button').setAttribute('style', 'background-color:blue');
  } else {
    canStart = false;
    document.getElementById('button').setAttribute('style', 'background-color:grey');
  }
});

socket.on('new game', () => {
  dead = false;
  document.getElementById('button').innerHTML = 'Start Game';
});

function button() {
  if (dead) {
    socket.emit('join');
  } else if (canStart) {
    socket.emit('start');
  }
}