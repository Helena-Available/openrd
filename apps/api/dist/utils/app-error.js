export class AppError extends Error {
    statusCode;
    isOperational;
    details;
    constructor(message, statusCode = 500, details) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.isOperational = statusCode >= 400 && statusCode < 500;
        this.details = details;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }
}
//# sourceMappingURL=app-error.js.map