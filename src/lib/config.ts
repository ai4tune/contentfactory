export type AppConfigStatus = {
  ready: boolean;
  environment: string;
  accessConfigured: boolean;
  dataDirectoryConfigured: boolean;
  supabaseAuthConfigured: boolean;
  supabasePersistenceConfigured: boolean;
  captureConfigured: boolean;
  feishuConfigured: boolean;
  aiConfigured: boolean;
  imageConfigured: boolean;
  marketConfigured: boolean;
  uploadEnabled: boolean;
  missingRequired: string[];
};

export function getConfigStatus(): AppConfigStatus {
  const environment = process.env.NODE_ENV || "development";
  const accessConfigured = Boolean(process.env.CONTENT_FACTORY_ACCESS_CODE);
  const dataDirectoryConfigured = Boolean(process.env.CONTENT_FACTORY_DATA_DIR);
  const supabaseAuthConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const supabasePersistenceConfigured = Boolean(
    supabaseAuthConfigured
    && process.env.SUPABASE_SERVICE_ROLE_KEY
    && process.env.CONTENT_FACTORY_WORKSPACE_ID,
  );
  const captureConfigured = Boolean(process.env.CONTENT_FACTORY_CAPTURE_TOKEN);
  const aiConfigured = Boolean(process.env.AI_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL);
  const missingRequired = [
    ...(!aiConfigured ? ["AI_BASE_URL / AI_API_KEY / AI_MODEL"] : []),
    ...(environment === "production" && !supabaseAuthConfigured && !accessConfigured
      ? ["Supabase auth or CONTENT_FACTORY_ACCESS_CODE"] : []),
    ...(environment === "production" && supabaseAuthConfigured && !supabasePersistenceConfigured
      ? ["SUPABASE_SERVICE_ROLE_KEY / CONTENT_FACTORY_WORKSPACE_ID"] : []),
    ...(environment === "production" && !supabaseAuthConfigured && !dataDirectoryConfigured
      ? ["CONTENT_FACTORY_DATA_DIR"] : []),
  ];

  return {
    ready: missingRequired.length === 0,
    environment,
    accessConfigured,
    dataDirectoryConfigured,
    supabaseAuthConfigured,
    supabasePersistenceConfigured,
    captureConfigured,
    feishuConfigured: Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET),
    aiConfigured,
    imageConfigured: Boolean(
      process.env.IMAGE_BASE_URL && process.env.IMAGE_API_KEY && process.env.IMAGE_MODEL,
    ),
    marketConfigured: Boolean(process.env.REDFOX_API_KEY),
    uploadEnabled: process.env.UPLOADS_ENABLED !== "false",
    missingRequired,
  };
}

export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}
