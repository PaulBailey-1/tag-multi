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
}, 1000 / 30);

var canvas = document.getElementById('canvas');
canvas.width = 1000;
canvas.height = 500;
var ctx = canvas.getContext('2d');

socket.on('state', function(data) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  data.platformData.forEach( function (platform, i) {
    ctx.fillStyle = "black";
    ctx.fillRect(platform.x, platform.y, platformWidth, platformHeight);
  });

  data.powerUpData.forEach(function (powerUp, i) {
    ctx.fillStyle = "orange";
    ctx.fillRect(powerUp.x, powerUp.y, powerUpSize, powerUpSize);
  });

  var scorePos = 50;
  let playerCount = 0;
  for (var id in data.playerData) {
    playerCount++;
    var player = data.playerData[id];
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
