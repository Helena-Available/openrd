import { Pool } from 'pg';
let pool = null;
export const initPool = (env, logger) => {
    if (!pool) {
        pool = new Pool({
            connectionString: env.DATABASE_URL,
            max: env.isTest ? 1 : undefined,
            ssl: env.isProduction ? { rejectUnauthorized: false } : undefined,
        });
        pool.on('error', (error) => {
            logger.error({ error }, 'Unexpected database error');
        });
        logger.info('PostgreSQL connection pool initialized');
    }
    return pool;
};
export const getPool = () => {
    if (!pool) {
        throw new Error('Database pool has not been initialized');
    }
    return pool;
};
//# sourceMappingURL=pool.js.map