export class Interface{

    constructor(inputStream, outputStream){
        this.input = inputStream;
        this.output = outputStream;
    }

    printAt = (x, y, message) => {

        this.output.cursorTo(x, y);
        if (typeof message === 'string' || message instanceof Buffer){
            this.output.write(message);
        } else {
            //object { message, style}
            message.style ? this.output.write(message.style(message.message)) : this.output.write(message.message);
        }
  
    }
    
    //imitates human types
    typeAt = (x, y, message) => {
    
        return new Promise((resolve) => {
    
            const out = (char) => {
                this.printAt(x++, y, char);
            }
            let index = 0;
    
            let timer = setInterval(() => {
                if (index < message.length) out(message[index++]);
                if (index == message.length) {
                    clearInterval(timer);
                    resolve();
                }
            }, 20);
        });
    }
    
    hideCursor = () => {
        this.output.write('\u001B[?25l');
    }
    
    showCursor = () => {
        this.output.write('\u001B[?25h');
    }

    blink = (x, y, message) => {

        let space;
        if (typeof message === 'string' || message instanceof Buffer){
            space = Buffer.alloc(message.length,' ');
        }
        else{
            space = Buffer.alloc(message.message.length,' ');
        }

        const blinkMessage = (iterator) => {
            (iterator % 2) ? this.printAt(x, y, message) : this.printAt(x, y, space);
        }

        let iterator = 1;

        const timer = setInterval(() => {
            blinkMessage(iterator++ % 2);
        }, 300);

        return timer;

    }

}

