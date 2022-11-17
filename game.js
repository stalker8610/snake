import { EventEmitter } from 'node:events'
import chalk from 'chalk';
import { Snake } from './snake.js'

const styledMessage = (message, style) => {
    return {
        message,
        style
    }
}

export class Game extends EventEmitter {

    //private zone! for geeks only
    #field;
    #cookies;
    #obstacles;
    #pendingDirectionChange;
    #gamePaused;
    #gameStarted;
    #score;
    #snake;
    #loopTimer;
    #crashTimer;
    #pauseTimer;
    #currentLevel;
    #interval;
    #interface;

    //configurable zone
    static initialInterval = 250;
    static initialSnakeLength = 5;
    static initialCookiesCount = 3;
    static timeToStartInSec = 3;

    static cheerPhrasesTemplate = [
        'GOOD!',
        'VERY GOOD!',
        'NICE BRO',
        'UNBELIEVABLE!',
        'REALLY?!',
        'RELAX, MAN',
        'ARE YOU ROBOT?!',
        'PLEASE STOP IT',
        'OKAY, YOU WIN..'
    ];

    static cheerPhrasesScore = [0, 50, 150, 340, 550, 715, 900, 1000, 1100];

    static boundaryView = styledMessage('*', chalk.gray);
    static obstacleView = styledMessage('X', chalk.red.bold);
    static cookieView = styledMessage('$', chalk.yellow.bold);
    static snakeBodyView = styledMessage('x', chalk.green);
    static snakeTraceView = styledMessage('.', chalk.gray);
    static snakeCrashedHeadView = styledMessage('x', chalk.red);

    static serviceMessages = {
        paused: styledMessage('-= PAUSED =-', chalk.yellow),
        gameOver: styledMessage('-= OH NO... GAME OVER BRO =-', chalk.redBright),
        cheer: styledMessage('', chalk.greenBright),
        intro: styledMessage('', chalk.yellow),
    }

    constructor(fieldWidth, fieldHeight, ioInterface, logger) {

        super();

        this.#field = {
            width: fieldWidth - (1 - fieldWidth % 2), //odd required
            height: fieldHeight
        }
        this.#interface = ioInterface;
        this.logger = logger;

    }

    async init(firstPlay = true) {

        console.clear();
        const controlMessage = 'Press Ctrl+C to exit, P to pause...';

        if (firstPlay)
            await this.#interface.typeAt(0, 0, controlMessage);
        else
            this.#interface.printAt(0, 0, controlMessage);

        this.#cookies = [];
        this.#obstacles = [];

        this.#score = 0;
        this.#currentLevel = -1;
        this.#gameStarted = false;
        this.#gamePaused = false;
        this.#pendingDirectionChange = false;

        this.#loopTimer = null;
        this.#pauseTimer = null;
        this.#interval = Game.initialInterval;

    }

    createSnake(initialSnakeLength) {

        let xPos = Math.ceil(this.#field.width / 2);
        if (xPos % 2) xPos--; //even required
        let yPos = Math.floor((this.#field.height + initialSnakeLength) / 2);

        this.#snake = new Snake(initialSnakeLength, xPos, yPos);

        for (let i = 0; i < initialSnakeLength; i++) {
            this.#interface.printAt(xPos, yPos - i, Game.snakeBodyView);
        }

        this.logger.log('snake created');

    }

    drawMainField() {
        const borderLine = styledMessage(Buffer.alloc(this.#field.width, Game.boundaryView.message + ' '), Game.boundaryView.style);
        this.#interface.printAt(0, 1, borderLine);
        for (let i = 2; i < this.#field.height; i++) {
            this.#interface.printAt(0, i, Game.boundaryView);
            this.#interface.printAt(this.#field.width - 1, i, Game.boundaryView);
        }
        this.#interface.printAt(0, this.#field.height, borderLine);
    }


    async showIntro(sec) {

        return new Promise((resolve) => {

            let counter = sec * 2;

            const counterTimer = setInterval(() => {

                const message = (counter % 2) ? ''
                    : (counter == 0) ? 'GO!!!' : `START WITHIN ${counter / 2} SEC`;

                this.printServiceMessage(styledMessage(message, Game.serviceMessages.intro.style));

                if (counter == 0) {
                    clearInterval(counterTimer);
                    resolve();
                }
                else {
                    counter--;
                }

            }, 500);
        })

    }

    async start() {

        this.keypressListener = (str, key) => {

            // console.log(`You pressed the "${str}" key`);
            // console.log(key);

            if (key.ctrl && key.name === 'c') {
                this.destroy();
            }
            else if (this.#gameStarted) {
                if (key.name === 'p') {
                    this.tooglePause();
                }
                else if (['left', 'right', 'up', 'down'].includes(key.name) && !this.#pendingDirectionChange && !this.#gamePaused) {

                    const directionChanged = this.#snake.changeDirection(key.name);
                    if (directionChanged) {
                        this.#pendingDirectionChange = true;
                        this.logger.log(`direction changed`);
                    }

                }
            }

        }

        this.#interface.input.on('keypress', this.keypressListener);

        this.drawMainField();
        this.drawResultsField();
        this.printScore();
        this.createSnake(Game.initialSnakeLength);
        this.putCookie(Game.initialCookiesCount);

        await this.showIntro(Game.timeToStartInSec);

        this.#gameStarted = true;
        this.#loopTimer = setTimeout(this.gameLoop.bind(this), this.#interval);

    }

    redrawSnake(tailToHide) {

        if (tailToHide) {
            this.#interface.printAt(tailToHide.x, tailToHide.y, Game.snakeTraceView);
        }

        const head = this.#snake.getHeadPosition();
        this.#interface.printAt(head.x, head.y, Game.snakeBodyView);

    }

    gameLoop() {

        const cookieWereEaten = this.checkSnakeEatCookie();

        let tailToHide = cookieWereEaten ? null : this.#snake.getTailPosition();

        if (cookieWereEaten) {
            this.updateScore();
        }

        this.#snake.move(cookieWereEaten);
        this.#pendingDirectionChange = false;

        this.redrawSnake(tailToHide);

        if (!this.checkFail()) {
            if (cookieWereEaten) {

                const cheerIndex = Game.cheerPhrasesScore.findIndex((value, index) => this.#currentLevel < index && this.#score >= value);
                if (cheerIndex > this.#currentLevel) {
                    this.#currentLevel = cheerIndex;
                    const message = Game.cheerPhrasesTemplate[cheerIndex];
                    this.printServiceMessage(styledMessage(message, Game.serviceMessages.cheer.style));
                }

                this.speedUp();
                this.putObstacle();

            }
            this.#loopTimer = setTimeout(this.gameLoop.bind(this), this.#interval);
        }
    }

    tooglePause() {

        this.#gamePaused = !this.#gamePaused;

        if (this.#gamePaused) {

            if (this.#loopTimer) {
                clearTimeout(this.#loopTimer);
                this.#loopTimer = null;
            }

            const blinkPauseMessage = (iterator) => {

                if (iterator % 2) {
                    this.printServiceMessage(Game.serviceMessages.paused);
                } else {
                    this.printServiceMessage('');
                }

            }

            let iterator = 1;

            this.#pauseTimer = setInterval(() => {
                if (!this.#gamePaused && iterator % 2) {
                    //already pause toogled off and service message was clean
                    clearInterval(this.#pauseTimer);
                    this.#pauseTimer = null;
                }
                else blinkPauseMessage(iterator++ % 2);
            }, 300);
        }
        else {
            this.#loopTimer = setTimeout(this.gameLoop.bind(this), this.#interval);
        }
    }

    gameOver() {

        this.#interface.input.removeListener('keypress', this.keypressListener);
        this.#gameStarted = false;

        this.printServiceMessage(Game.serviceMessages.gameOver);

        setTimeout(() => {

            this.keypressListener = async (str, key) => {

                if (key.ctrl && key.name === 'c') {
                    this.destroy();
                }
                else if (key.name == 'n') {
                    this.destroy();
                }
                else if (key.name == 'y') {

                    this.#interface.input.removeListener('keypress', this.keypressListener);

                    if (this.#crashTimer)
                        clearInterval(this.#crashTimer);

                    await this.init(false);
                    this.start();

                }
            };

            this.#interface.input.on('keypress', this.keypressListener);

            this.#interface.printAt(0, this.#field.height + 2, 'Try again?.. [y/n]');
        }, 1000);

    }

    destroy() {

        if (this.keypressListener) {
            this.#interface.input.removeListener('keypress', this.keypressListener);
        }

        if (this.#pauseTimer) {
            clearInterval(this.#pauseTimer);
        }

        if (this.#loopTimer) {
            clearTimeout(this.#loopTimer);
        }

        if (this.#crashTimer) {
            clearInterval(this.#crashTimer);
        }

        this.emit('exit');

    }

    checkFail() {

        const snakeHeadPosition = this.#snake.getHeadPosition();

        let crashHappened = false;

        if (snakeHeadPosition.x === this.#field.width - 1
            || snakeHeadPosition.x === 0
            || snakeHeadPosition.y === 1
            || snakeHeadPosition.y === this.#field.height
            || this.#snake.isOnBody(snakeHeadPosition, true))

            crashHappened = true;
        else {

            for (let obstacle of this.#obstacles) {
                if (obstacle.x === snakeHeadPosition.x && obstacle.y === snakeHeadPosition.y) {
                    crashHappened = true;
                    break;
                }
            }
        }

        if (crashHappened) {
            this.crashSnake();
            this.gameOver();
        }

        return crashHappened;

    }

    crashSnake() {
        const headPosition = this.#snake.getHeadPosition();
        this.#crashTimer = this.#interface.blink(headPosition.x, headPosition.y, Game.snakeCrashedHeadView);
    }

    checkSnakeEatCookie() {

        const snakeHeadPosition = this.#snake.getHeadPosition();

        let cookieToEat = -1;

        for (let i = 0; i < this.#cookies.length; i++) {
            const cookie = this.#cookies[i];
            if (cookie.x == snakeHeadPosition.x && cookie.y == snakeHeadPosition.y) {
                cookieToEat = i;
                break;
            }
        }

        if (cookieToEat != -1) {
            this.#cookies.splice(cookieToEat, 1);
            this.putCookie();
            this.logger.log(`cookie were eaten`);
            return true;
        }

        return false;

    }

    newRandomPointOnField() {
        return {
            x: 2 + Math.floor(Math.random() * (this.#field.width - 3) / 2) * 2,
            y: 2 + Math.floor(Math.random() * (this.#field.height - 2))
        }
    }

    badPositionForNewObject(newObject) {
        return (this.#cookies.find((cookie) => cookie.x === newObject.x && cookie.y === newObject.y)
            || this.#obstacles.find((obstacle) => obstacle.x === newObject.x && obstacle.y === newObject.y)
            || this.#snake.isOnBody(newObject));
    }

    putCookie(count = 1) {

        for (let i = 0; i < count; i++) {

            let newCookie;
            do {
                newCookie = this.newRandomPointOnField();
            } while (this.badPositionForNewObject(newCookie))

            this.#cookies.push(newCookie);
            this.#interface.printAt(newCookie.x, newCookie.y, Game.cookieView)
        }

    }

    putObstacle(count = 1) {

        for (let i = 0; i < count; i++) {

            let newObstacle;
            do {
                newObstacle = this.newRandomPointOnField();
            } while (this.badPositionForNewObject(newObstacle))

            this.#obstacles.push(newObstacle);
            this.#interface.printAt(newObstacle.x, newObstacle.y, Game.obstacleView);
        }

    }

    speedUp() {
        this.#interval -= 1.2 * Math.log2(this.#interval);
    }

    updateScore() {
        this.#score += 5 * this.#snake.getLength();
        this.printScore();
    }

    printServiceMessage(message) {
        this.#interface.printAt(0, this.#field.height + 1, Buffer.alloc(this.#field.width, ' ')); //clean line

        if (!message) return;

        if (typeof message === 'string' || message instanceof Buffer) {
            this.#interface.printAt(Math.floor((this.#field.width - message.length) / 2), this.#field.height + 1, message);

        } else {
            //object {messsage, style}
            this.#interface.printAt(Math.floor((this.#field.width - message.message.length) / 2), this.#field.height + 1, message);
        }

    }

    drawResultsField() {
        this.#interface.printAt(this.#field.width + 3, 0, `Your score:`);
        this.#interface.printAt(this.#field.width + 3, 2, `Note that our snake:`);
        this.#interface.printAt(this.#field.width + 3 + 2, 3, `- ${chalk.yellow('likes')} yellow cookies`);
        this.#interface.printAt(this.#field.width + 3 + 2, 4, `- ${chalk.red('afraid')} of red obstacles!`);
    }

    printScore() {
        this.#interface.printAt(this.#field.width + 3 + `Your score:`.length + 1, 0,
            styledMessage(`${this.#score.toLocaleString()}`, chalk.yellow.bold));
    }

}
