const isProduction = process.env.NODE_ENV === 'production';

const createLogger = (moduleName = 'App') => {
    return {
        debug: (...args) => {
            if (!isProduction) {
                console.log(`[${moduleName}] DEBUG:`, ...args);
            }
        },
        info: (...args) => {
            if (!isProduction) {
                console.log(`[${moduleName}] INFO:`, ...args);
            }
        },
        warn: (...args) => {
            console.warn(`[${moduleName}] WARN:`, ...args);
        },
        error: (...args) => {
            console.error(`[${moduleName}] ERROR:`, ...args);
        }
    };
};

module.exports = createLogger;