import pino from 'pino';
export const createLogger = (env) => pino({
    level: env.LOG_LEVEL,
    transport: env.isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
            },
        },
});
//# sourceMappingURL=logger.js.map