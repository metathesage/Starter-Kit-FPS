const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusDisplay = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

const TILE_SIZE = 40;
const ROWS = canvas.height / TILE_SIZE;
const COLS = canvas.width / TILE_SIZE;

// 0: Floor, 1: Wall, 2: Goal
const map = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

let player = {
    x: 1,
    y: 1,
    color: '#3498db'
};

let enemies = [
    { x: 7, y: 1, dx: 1, dy: 0, color: '#e74c3c' },
    { x: 3, y: 7, dx: 0, dy: -1, color: '#e74c3c' },
    { x: 11, y: 5, dx: 0, dy: 1, color: '#e74c3c' }
];

let gameOver = false;

function drawMap() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (map[row][col] === 1) {
                ctx.fillStyle = '#2c3e50';
                ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            } else if (map[row][col] === 2) {
                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}

function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x * TILE_SIZE + TILE_SIZE / 2, player.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawEnemies() {
    enemies.forEach(enemy => {
        ctx.fillStyle = enemy.color;
        ctx.fillRect(enemy.x * TILE_SIZE + 5, enemy.y * TILE_SIZE + 5, TILE_SIZE - 10, TILE_SIZE - 10);
    });
}

function updateEnemies() {
    if (gameOver) return;
    
    enemies.forEach(enemy => {
        let nextX = enemy.x + enemy.dx;
        let nextY = enemy.y + enemy.dy;

        if (map[nextY][nextX] === 1) {
            enemy.dx *= -1;
            enemy.dy *= -1;
        } else {
            enemy.x = nextX;
            enemy.y = nextY;
        }

        // Collision with player
        if (enemy.x === player.x && enemy.y === player.y) {
            endGame(false);
        }
    });
}

function movePlayer(dx, dy) {
    if (gameOver) return;

    let nextX = player.x + dx;
    let nextY = player.y + dy;

    if (map[nextY][nextX] !== 1) {
        player.x = nextX;
        player.y = nextY;

        // Check for win
        if (map[player.y][player.x] === 2) {
            endGame(true);
        }
    }

    // Check for collision after move
    enemies.forEach(enemy => {
        if (enemy.x === player.x && enemy.y === player.y) {
            endGame(false);
        }
    });

    draw();
}

function endGame(win) {
    gameOver = true;
    if (win) {
        statusDisplay.innerText = "YOU WIN! 🎉";
        statusDisplay.style.color = "#2ecc71";
    } else {
        statusDisplay.innerText = "GAME OVER! 💀";
        statusDisplay.style.color = "#e74c3c";
    }
}

function resetGame() {
    player = { x: 1, y: 1, color: '#3498db' };
    enemies = [
        { x: 7, y: 1, dx: 1, dy: 0, color: '#e74c3c' },
        { x: 3, y: 7, dx: 0, dy: -1, color: '#e74c3c' },
        { x: 11, y: 5, dx: 0, dy: 1, color: '#e74c3c' }
    ];
    gameOver = false;
    statusDisplay.innerText = "Good Luck!";
    statusDisplay.style.color = "#ecf0f1";
    draw();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawMap();
    drawPlayer();
    drawEnemies();
}

window.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w': case 'arrowup': movePlayer(0, -1); break;
        case 's': case 'arrowdown': movePlayer(0, 1); break;
        case 'a': case 'arrowleft': movePlayer(-1, 0); break;
        case 'd': case 'arrowright': movePlayer(1, 0); break;
    }
});

resetBtn.addEventListener('click', resetGame);

// Enemy movement interval
setInterval(updateEnemies, 500);
setInterval(draw, 100);

draw();
