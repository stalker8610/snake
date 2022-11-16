
import * as fs from 'fs';

export class Logger {

    constructor(fileName) {
        this.stream = fs.createWriteStream(fileName);
        process.on('exit', () => {
            this.close();
        })
    }

    log(data) {
        this.stream.write(data+'\n');
    }

    close() {
        this.stream.write('stream closed');
        this.stream.close();
    }
}