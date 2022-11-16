import * as readline from 'readline';
import { Logger } from './logger.js'
import { Interface } from './interface.js'
import { Game } from './game.js'

readline.emitKeypressEvents(process.stdin);

process.stdin.setRawMode(true);

process.on('error', (err) => {
    console.error(err);
})

const emptyFunction = () => { }
const debugMode = false;
let logger = debugMode ? new Logger('debug.txt') :
    {
        log: emptyFunction,
        close: emptyFunction
    };

const ioInterface = new Interface(process.stdin, process.stdout);

(async () => {

    const [windowWidth, windowHeight] = ioInterface.output.getWindowSize();
    if (!(windowWidth >= 40 && windowHeight >= 15)) {
        console.log('Terminal window is to small for game, please resize and try again...');
        process.exit(1);
    }

    process.on('exit', () => { 
        console.clear();
        ioInterface.showCursor();
        logger.close();
     });
    
    ioInterface.hideCursor();

    const game = new Game(Math.min(windowWidth, 50), Math.min(windowHeight - 3, 20), ioInterface, logger);
    game.on('exit', () => process.exit());
    await game.init();
    game.start();

})()







