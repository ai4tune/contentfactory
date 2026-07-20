export type AppConfigStatus = {
  feishuConfigured: boolean;
  aiConfigured: boolean;
  uploadEnabled: boolean;
};

export function getConfigStatus(): AppConfigStatus {
  return {
    feishuConfigured: Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET),
    aiConfigured: Boolean(process.env.AI_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL),
    uploadEnabled: process.env.UPLOADS_ENABLED !== "false",
  };
}

export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}
