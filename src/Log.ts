
import * as fsMod from 'fs';
const fs = fsMod.promises;

const Debug = require('klesun-node-tools/src/Debug.js');

let whenLogsDirCheck: Promise<boolean> | null = null;

const logsDirPath = __dirname + '/../out';

let tailPromise = Promise.resolve();

/** to make sure all entries will be in chronological order */
const queued = (action: () => Promise<any>) => {
    tailPromise = tailPromise
        .catch(exc => {})
        .then(action);
    return tailPromise;
};

const Log = {
    info: async (msgData: any) => {
        if (whenLogsDirCheck === null) {
            whenLogsDirCheck = fs.stat(logsDirPath)
                .then(info => true)
                .catch(exc => false);
        }
        const hasLogsDir = await whenLogsDirCheck;
        if (hasLogsDir) {
            const path = logsDirPath + '/Debug_log.txt';
            const formatted = Debug.jsExport(msgData);
            await queued(() => fs.appendFile(path, formatted + ',\n'));
        }
    },
};

export default Log;