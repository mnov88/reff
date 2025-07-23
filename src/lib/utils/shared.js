/**
 * Used to store Web worker regular expression matching results.
 * Stores a `cursor` index to allow iterating results
 */
class SharedCtx {
    constructor() {

        let data = {};

        this.getData = function (text) {
            let items = Object.values(data).filter(v => v && v.text === text && v.cursor !== undefined);
            return items[0];
        };

        this.setMatches = function (uuid, text, matches) {
            if (!data[uuid]) {
                data[uuid] = {};
            }

            data[uuid].cursor = 0;
            data[uuid].uuid = uuid;
            data[uuid].text = text;
            data[uuid].matches = matches;
        };

        this.setCallback = function (uuid, text, fn) {
            if (!data[uuid]) {
                data[uuid] = { text: text, fns: [] };
            }

            data[uuid].fns.push(fn);
        };

        this.callback = function (uuid, text) {
            if (data[uuid] && data[uuid].fns) {
                data[uuid].fns.forEach(function (callable) {
                    callable.call();
                });
            }
        };

        this.reset = function (uuid) {
            data[uuid] = null;
        };

        this.clear = function () {
            data = {};
        };
    }
}

let sharedCtx = new SharedCtx();

export {
    sharedCtx
}