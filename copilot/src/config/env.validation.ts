import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  APP_NAME: Joi.string().default('buntu-copilot'),

  DATABASE_URL: Joi.string().uri().required(),

  LLM_PROVIDER: Joi.string()
    .valid('openai', 'anthropic', 'mistral', 'local')
    .default('openai'),
  LLM_API_KEY: Joi.string().required(),
  LLM_MODEL: Joi.string().default('gpt-4o'),
  LLM_MAX_TOKENS: Joi.number().default(4096),
  LLM_TEMPERATURE: Joi.number().min(0).max(2).default(0.2),
  LLM_STRUCTURED_OUTPUT_RETRIES: Joi.number().integer().min(0).max(5).default(2),
  LLM_MAX_CONTEXT_TOKENS: Joi.number().integer().min(1000).default(100000),
  LLM_BASE_URL: Joi.string().uri().optional().allow(''),

  GITHUB_TOKEN: Joi.string().optional().allow(''),
  GITHUB_BASE_BRANCH: Joi.string().optional().default('main'),
  GITHUB_APP_ID: Joi.string().optional().allow(''),
  GITHUB_APP_PRIVATE_KEY: Joi.string().optional().allow(''),
  GITHUB_WEBHOOK_SECRET: Joi.string().optional().allow(''),

  VECTOR_DIMENSION: Joi.number().default(1536),
});
