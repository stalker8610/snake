export class Snake {

    #chain;
    #length;

    constructor(length, startX, startY) {
        this.#length = length;
        this.#chain = [
            {
                length,
                x: startX,
                y: startY,
                dx: 0,
                dy: -1,
            }
        ];

    }

    getHead() {
        return this.#chain[this.#chain.length - 1];
    }

    getHeadPosition() {
        const head = this.getHead();
        return {
            x: head.x + head.dx * (head.length - 1),
            y: head.y + head.dy * (head.length - 1)
        }
    }

    getTailPosition() {
        return { x: this.#chain[0].x, y: this.#chain[0].y };
    }

    getLength() {
        return this.#length;
    }

    isOnBody({ x, y }, excludeHead = false) {

        for (let i = 0; i < this.#chain.length; i++) {
            const chunk = this.#chain[i];

            if (x >= Math.min(chunk.x, chunk.x + chunk.dx * (chunk.length - 1))
                && x <= Math.max(chunk.x, chunk.x + chunk.dx * (chunk.length - 1))
                && y === chunk.y

                ||

                y >= Math.min(chunk.y, chunk.y + chunk.dy * (chunk.length - 1))
                && y <= Math.max(chunk.y, chunk.y + chunk.dy * (chunk.length - 1))
                && x === chunk.x) {

                if (excludeHead && i === this.#chain.length - 1) continue;
                else return true;

            }
        }

        return false;
    }

    //return true if directon really was changed, false else
    changeDirection(direction) {

        let newDx = 0, newDy = 0;

        const head = this.getHead();

        switch (direction) {

            case 'right':
                if (!head.dx) newDx = 2;
                break;
            case 'left':
                if (!head.dx) newDx = -2;
                break;

            case 'up':
                if (!head.dy) newDy = -1;
                break;

            case 'down':
                if (!head.dy) newDy = 1;
                break;

        }

        if (newDx || newDy) {

            this.#chain.push({
                length: 0,
                x: head.x + head.dx * (head.length - 1) + newDx,
                y: head.y + head.dy * (head.length - 1) + newDy,
                dx: newDx,
                dy: newDy,
            })

            return true;
        }

        return false;

    }

    move(cookieWereEaten) {

        //cut tail unless cookie were eaten
        if (cookieWereEaten) {
            this.#length++;
        } else {
            const tail = this.#chain[0];
            tail.length--;

            if (!tail.length) {
                this.#chain.shift(); // now tail is the next chunk
            }
            else {
                tail.x += this.#chain[0].dx;
                tail.y += this.#chain[0].dy;
            }
        }

        //head grows up always
        const head = this.getHead();
        head.length++;

    }

}