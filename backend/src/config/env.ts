import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(8000),
  GRPC_HOST: z.string().default("0.0.0.0"),
  GRPC_PORT: z.coerce.number().default(50051),
  JWT_SECRET: z.string().min(32).default("dev-super-secret-key-min-32-chars-long-1234"),
  JWT_EXPIRES_IN: z.string().default("24h"),
  CORS_ORIGINS: z.string().default("*"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  process.exit(1);
}

export const env = _env.data;
