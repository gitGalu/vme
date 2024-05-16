export class TouchControllerBase {

    constructor() {
        if (new.target === TouchControllerBase) {
            throw new Error();
        }
    }

    show() {
        throw new Error();
    }

    hide() {
        throw new Error();
    }

}