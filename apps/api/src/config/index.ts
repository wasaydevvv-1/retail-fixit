/**

 * Central, validated environment configuration.

 * Reading env vars anywhere else in the codebase is discouraged — import `config`.

 */



function bool(value: string | undefined, fallback: boolean): boolean {

  if (value === undefined) return fallback;

  return value.toLowerCase() === 'true' || value === '1';

}



function num(value: string | undefined, fallback: number): number {

  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;

}



export const config = {

  env: process.env.NODE_ENV ?? 'development',

  port: num(process.env.API_PORT, 4000),

  basePath: process.env.API_BASE_PATH ?? '/api/v1',

  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',



  cosmos: {

    connectionString: process.env.COSMOS_CONNECTION_STRING ?? '',

    endpoint: process.env.COSMOS_ENDPOINT ?? '',

    key: process.env.COSMOS_KEY ?? '',

    database: process.env.COSMOS_DATABASE ?? 'retailfixit',

  },



  auth: {
    devJwtSecret: process.env.AUTH_DEV_JWT_SECRET ?? 'dev-only-change-me',
    azureAdTenantId: process.env.AZURE_AD_TENANT_ID ?? '',
    azureAdClientId: process.env.AZURE_AD_CLIENT_ID ?? '',
    azureAdAudience: process.env.AZURE_AD_AUDIENCE ?? '',
    /** Client secret for Microsoft Graph (search/create Entra users from admin UI). */
    azureAdClientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? '',
    /** Default UPN suffix for new Entra users (e.g. wasaydevvgmail.onmicrosoft.com). */
    entraDefaultDomain: process.env.AUTH_ENTRA_DEFAULT_DOMAIN ?? '',
    /** Business tenant for users auto-provisioned on first Entra login. */
    defaultTenantId: process.env.AUTH_DEFAULT_TENANT_ID ?? 'tenant_acme',
    /** Allow public vendor company self-registration (POST /auth/register/vendor). */
    vendorSelfRegistrationEnabled: bool(process.env.VENDOR_SELF_REGISTRATION_ENABLED, true),
  },



  events: {

    driver: (process.env.EVENT_BUS_DRIVER ?? 'in-memory') as 'in-memory' | 'service-bus',

    serviceBusConnectionString: process.env.SERVICE_BUS_CONNECTION_STRING ?? '',

    serviceBusQueueName: process.env.SERVICE_BUS_QUEUE_NAME ?? 'retailfixit-events',

  },



  realtime: {

    driver: (process.env.REALTIME_DRIVER ?? 'local-ws') as 'local-ws' | 'signalr',

    signalrConnectionString: process.env.SIGNALR_CONNECTION_STRING ?? '',

  },



  ai: {

    useMock: bool(process.env.AI_USE_MOCK, true),

    endpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',

    apiKey: process.env.AZURE_OPENAI_API_KEY ?? '',

    deployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o-mini',

    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-02-15-preview',

    timeoutMs: num(process.env.AI_REQUEST_TIMEOUT_MS, 8000),

    maxRetries: num(process.env.AI_MAX_RETRIES, 2),

  },



  observability: {

    logLevel: process.env.LOG_LEVEL ?? 'info',

    appInsightsConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ?? '',

  },

  redis: {

    url: process.env.REDIS_URL ?? '',

  },

} as const;



export type AppConfig = typeof config;



/** Entra ID is active when tenant, client, and audience are all set. */

export function isEntraAuthEnabled(): boolean {

  return Boolean(

    config.auth.azureAdTenantId &&

      config.auth.azureAdClientId &&

      config.auth.azureAdAudience,

  );

}

/** Microsoft Graph directory search (admin user picker). */
export function isEntraGraphEnabled(): boolean {
  return isEntraAuthEnabled() && Boolean(config.auth.azureAdClientSecret);
}

