import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z
      .string()
      .min(1)
      .default('postgres://postgres:postgres@localhost:5432/fshd_openrd'),
    JWT_SECRET: z
      .string()
      .min(16, 'JWT_SECRET must be at least 16 characters long')
      .default('change-me-super-secret'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(6).max(14).default(10),
    CORS_ORIGIN: z.string().default('*'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    OPENAI_API_KEY: z.string().min(1).optional(),
    AI_API_BASE_URL: z.string().url().default('https://api.siliconflow.cn/v1'),
    AI_API_MODEL: z.string().default('deepseek-ai/DeepSeek-V3'),
    AI_API_TIMEOUT: z.coerce.number().int().positive().default(30000),
    PYTHON_PATH: z.string().default('python3'),
    // MCP相关环境变量
    MCP_ENABLED: z.string().default('true'),
    MCP_TIME_SERVICE_ENDPOINT: z.string().default('https://open.bigmodel.cn/api/mcp-broker/proxy/time/mcp'),
    MCP_TIME_SERVICE_TIMEOUT: z.string().default('10000'),
    MCP_TIME_SERVICE_RETRIES: z.string().default('3'),
    MCP_TIME_SERVICE_RETRY_DELAY: z.string().default('1000'),
    MCP_TIME_SERVICE_FALLBACK_ENABLED: z.string().default('true'),
    MCP_MEMORY_SERVICE_ENDPOINT: z.string().default('http://localhost:8080'),
    MCP_MEMORY_SERVICE_TIMEOUT: z.string().default('15000'),
    MCP_MEMORY_SERVICE_RETRIES: z.string().default('2'),
    MCP_MEMORY_SERVICE_RETRY_DELAY: z.string().default('2000'),
    MCP_MEMORY_SERVICE_FALLBACK_ENABLED: z.string().default('true'),
    MCP_MEMORY_FALLBACK_ENABLED: z.string().default('true'),
    MCP_MEMORY_FALLBACK_MAX: z.string().default('50'),
    MCP_CACHE_TIME_TTL: z.string().default('300000'),
    MCP_CACHE_MEMORY_TTL: z.string().default('600000')
  })
  .transform((value) => ({
    ...value,
    isProduction: value.NODE_ENV === 'production',
    isTest: value.NODE_ENV === 'test'
  }));

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export const loadAppEnv = (overrides?: NodeJS.ProcessEnv): AppEnv => {
  if (!cachedEnv) {
    loadEnv();
    const parsed = envSchema.safeParse({
      ...process.env,
      ...overrides
    });

    if (!parsed.success) {
      const message = parsed.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
      throw new Error(`Failed to parse environment variables: ${message}`);
    }

    cachedEnv = parsed.data;
  }

  return cachedEnv;
};

export const resetAppEnvCache = () => {
  cachedEnv = undefined;
};