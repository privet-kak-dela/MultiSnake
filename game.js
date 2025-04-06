var config = {
    type: Phaser.WEBGL,
    width: 720,
    height: 480,
    backgroundColor: '#7cfc00',
    parent: 'phaser-example',
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Константы
const GRID_SIZE = 16;
const GRID_WIDTH = Math.floor(config.width / GRID_SIZE);
const GRID_HEIGHT = Math.floor(config.height / GRID_SIZE);
const UP = 0;
const DOWN = 1;
const LEFT = 2;
const RIGHT = 3;

// Игровые объекты
var snake = null;
var food = null;
var cursors = null;
var scoreText = null;
var gameOverText = null;
var game = new Phaser.Game(config);

function preload() {
    this.load.image('food', 'assets/food.png');
    this.load.image('body', 'assets/body.png');
}

// Класс змейки
var Snake = new Phaser.Class({
    initialize: function Snake(scene, x, y) {
        this.headPosition = new Phaser.Geom.Point(x, y);
        this.body = scene.add.group();
        this.head = this.body.create(x * GRID_SIZE, y * GRID_SIZE, 'body');
        this.head.setOrigin(0);
        this.alive = true;
        this.speed = 100;
        this.moveTime = 0;
        this.tail = new Phaser.Geom.Point(x, y);
        this.heading = RIGHT;
        this.direction = RIGHT;
    },

    update: function(time) {
        if (time >= this.moveTime) return this.move(time);
    },

    faceLeft: function() {
        if (this.direction === UP || this.direction === DOWN) this.heading = LEFT;
    },

    faceRight: function() {
        if (this.direction === UP || this.direction === DOWN) this.heading = RIGHT;
    },

    faceUp: function() {
        if (this.direction === LEFT || this.direction === RIGHT) this.heading = UP;
    },

    faceDown: function() {
        if (this.direction === LEFT || this.direction === RIGHT) this.heading = DOWN;
    },

    move: function(time) {
        switch (this.heading) {
            case LEFT: this.headPosition.x = Phaser.Math.Wrap(this.headPosition.x - 1, 0, GRID_WIDTH); break;
            case RIGHT: this.headPosition.x = Phaser.Math.Wrap(this.headPosition.x + 1, 0, GRID_WIDTH); break;
            case UP: this.headPosition.y = Phaser.Math.Wrap(this.headPosition.y - 1, 0, GRID_HEIGHT); break;
            case DOWN: this.headPosition.y = Phaser.Math.Wrap(this.headPosition.y + 1, 0, GRID_HEIGHT); break;
        }

        this.direction = this.heading;
        Phaser.Actions.ShiftPosition(this.body.getChildren(), this.headPosition.x * GRID_SIZE, this.headPosition.y * GRID_SIZE, 1, this.tail);

        var hitBody = Phaser.Actions.GetFirst(this.body.getChildren(), { x: this.head.x, y: this.head.y }, 1);
        if (hitBody) {
            this.alive = false;
            if (gameOverText) gameOverText.setVisible(true);
            return false;
        }
        this.moveTime = time + this.speed;
        return true;
    },

    grow: function() {
        var newPart = this.body.create(this.tail.x, this.tail.y, 'body');
        newPart.setOrigin(0);
    },

    collideWithFood: function(food) {
        if (this.head.x === food.x && this.head.y === food.y) {
            this.grow();
            food.eat();
            if (scoreText) scoreText.setText('Score: ' + food.total);
            if (this.speed > 20 && food.total % 5 === 0) this.speed -= 5;
            return true;
        }
        return false;
    },

    updateGrid: function(grid) {
        this.body.children.each(function(segment) {
            var bx = segment.x / GRID_SIZE;
            var by = segment.y / GRID_SIZE;
            grid[by][bx] = false;
        });
        return grid;
    }
});

// Класс еды
var Food = new Phaser.Class({
    Extends: Phaser.GameObjects.Image,
    initialize: function Food(scene, x, y) {
        Phaser.GameObjects.Image.call(this, scene)
        this.setTexture('food');
        this.setPosition(x * GRID_SIZE, y * GRID_SIZE);
        this.setOrigin(0);
        this.total = 0;
        scene.children.add(this);
    },
    eat: function() { this.total++; }
});

function create() {
    this.socket = io();
    this.otherPlayers = this.add.group();

    // Обработчики сокетов
    this.socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            if (id === this.socket.id) {
                snake = new Snake(this, players[id].x, players[id].y);
            } else {
                addOtherPlayer(this, players[id]);
            }
        });
    });

    this.socket.on('newPlayer', (playerInfo) => addOtherPlayer(this, playerInfo));
    this.socket.on('playerDisconnected', (id) => removePlayer(this, id));
    this.socket.on('playerMoved', (data) => movePlayer(this, data));
    this.socket.on('foodPosition', (pos) => updateFoodPosition(pos));

    // Создание еды
    food = new Food(this, 3, 4);

    // UI элементы
    scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '20px', fill: '#000' });
    gameOverText = this.add.text(config.width/2, config.height/2, 'Game Over', { 
        fontSize: '40px', fill: '#ff0000' 
    }).setOrigin(0.5).setVisible(false);

    cursors = this.input.keyboard.createCursorKeys();
}

function update(time) {
    if (!snake || !snake.alive) return;
    
    // Отправка движения на сервер
    this.socket.emit('playerMovement', {
        x: snake.headPosition.x,
        y: snake.headPosition.y
    });

    // Обработка управления
    if (cursors.left.isDown) snake.faceLeft();
    else if (cursors.right.isDown) snake.faceRight();
    else if (cursors.up.isDown) snake.faceUp();
    else if (cursors.down.isDown) snake.faceDown();

    if (snake.update(time)) {
        if (snake.collideWithFood(food)) {
            repositionFood(this);
        }
    }
}

// Вспомогательные функции
function addOtherPlayer(scene, playerInfo) {
    const player = scene.add.sprite(
        playerInfo.x * GRID_SIZE, 
        playerInfo.y * GRID_SIZE, 
        'body'
    );
    player.setOrigin(0);
    player.playerId = playerInfo.playerId;
    scene.otherPlayers.add(player);
}

function removePlayer(scene, playerId) {
    scene.otherPlayers.getChildren().forEach(player => {
        if (player.playerId === playerId) player.destroy();
    });
}

function movePlayer(scene, data) {
    scene.otherPlayers.getChildren().forEach(player => {
        if (player.playerId === data.playerId) {
            player.setPosition(data.x * GRID_SIZE, data.y * GRID_SIZE);
        }
    });
}

function updateFoodPosition(pos) {
    food.setPosition(pos.x * GRID_SIZE, pos.y * GRID_SIZE);
}

function repositionFood(scene) {
    if (!snake) return false;

    let testGrid = Array(GRID_HEIGHT).fill().map(() => Array(GRID_WIDTH).fill(true));
    snake.updateGrid(testGrid);

    let validLocations = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            if (testGrid[y][x]) validLocations.push({ x, y });
        }
    }

    if (validLocations.length > 0) {
        let pos = Phaser.Math.RND.pick(validLocations);
        scene.socket.emit('newFoodPosition', pos);
        return true;
    }
    return false;
}