import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../../utils/app-error.js';
export class AuthService {
    env;
    logger;
    pool;
    constructor({ env, logger, pool }) {
        this.env = env;
        this.logger = logger;
        this.pool = pool;
    }
    createToken(user) {
        return jwt.sign({
            sub: user.id,
            role: user.role,
        }, this.env.JWT_SECRET, { expiresIn: this.env.JWT_EXPIRES_IN });
    }
    serializeUser(row) {
        return {
            id: row.id,
            phoneNumber: row.phone_number,
            email: row.email,
            role: row.role,
            createdAt: row.created_at,
        };
    }
    async register(payload) {
        const client = await this.pool.connect();
        try {
            const existing = await client.query('SELECT id FROM app_users WHERE phone_number = $1 OR (email IS NOT NULL AND email = $2)', [payload.phoneNumber, payload.email ?? null]);
            if (existing.rowCount) {
                throw new AppError('User already exists with the provided credentials', 409);
            }
            const passwordHash = await bcrypt.hash(payload.password, this.env.BCRYPT_SALT_ROUNDS);
            const inserted = await client.query(`INSERT INTO app_users (phone_number, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, phone_number, email, role, created_at`, [payload.phoneNumber, payload.email ?? null, passwordHash, payload.role]);
            const user = this.serializeUser(inserted.rows[0]);
            const token = this.createToken(user);
            this.logger.info({ userId: user.id }, 'User registered successfully');
            return { user, token };
        }
        finally {
            client.release();
        }
    }
    async login(payload) {
        const identifier = payload.phoneNumber ?? payload.email;
        const result = await this.pool.query(`SELECT id, phone_number, email, role, password_hash, created_at
       FROM app_users
       WHERE ${payload.phoneNumber ? 'phone_number = $1' : 'email = $1'}`, [identifier]);
        if (!result.rowCount) {
            throw new AppError('Invalid credentials', 401);
        }
        const userRow = result.rows[0];
        const isValid = await bcrypt.compare(payload.password, userRow.password_hash);
        if (!isValid) {
            throw new AppError('Invalid credentials', 401);
        }
        const user = this.serializeUser(userRow);
        const token = this.createToken(user);
        this.logger.info({ userId: user.id }, 'User logged in');
        return { user, token };
    }
}
//# sourceMappingURL=auth.service.js.map