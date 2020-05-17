
import * as fsMod from 'fs';
const fs = fsMod.promises;

const Debug = require('klesun-node-tools/src/Debug.js');

let whenLogsDirCheck: Promise<boolean> | null = null;

const logsDirPath = __dirname + '/../out';

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
            await fs.appendFile(path, formatted + ',\n');
        }
    },
};

export default Log;