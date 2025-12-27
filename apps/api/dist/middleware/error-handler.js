import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';
export const errorHandler = ({ logger }) => {
    return (error, _req, res) => {
        if (error instanceof AppError) {
            if (!error.isOperational) {
                logger.error({ error }, 'Operational error occurred');
            }
            res.status(error.statusCode).json({
                error: error.message,
                details: error.details,
            });
            return;
        }
        if (error instanceof ZodError) {
            res.status(400).json({
                error: 'Validation failed',
                details: error.flatten(),
            });
            return;
        }
        logger.error({ error }, 'Unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    };
};
//# sourceMappingURL=error-handler.js.map