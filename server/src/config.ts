import { z } from 'zod/v4';

const envSchema = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  AI_PROVIDER: z.enum(['mock', 'bedrock']).default('mock'),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  BEDROCK_MODEL_ID: z.string().min(1).default('amazon.nova-lite-v1:0'),
  BEDROCK_STRICT: z.stringbool().default(false),
});

export interface AppConfig {
  host: string;
  port: number;
  allowedOrigins: string[];
  aiProvider: 'mock' | 'bedrock';
  awsRegion: string;
  bedrockModelId: string;
  bedrockStrict: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    host: parsed.HOST,
    port: parsed.PORT,
    allowedOrigins: parsed.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean),
    aiProvider: parsed.AI_PROVIDER,
    awsRegion: parsed.AWS_REGION,
    bedrockModelId: parsed.BEDROCK_MODEL_ID,
    bedrockStrict: parsed.BEDROCK_STRICT,
  };
}
