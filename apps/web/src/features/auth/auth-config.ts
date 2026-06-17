import { Configuration, LogLevel, type PopupRequest } from '@azure/msal-browser';

const tenantId = import.meta.env.VITE_AZURE_AD_TENANT_ID ?? '';
const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID ?? '';
const apiScope = import.meta.env.VITE_AZURE_AD_API_SCOPE ?? '';

export function isEntraConfiguredOnWeb(): boolean {
  return Boolean(tenantId && clientId && apiScope);
}

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
    },
  },
};

export const loginRequest: PopupRequest = {
  scopes: [apiScope, 'openid', 'profile', 'email'],
};
