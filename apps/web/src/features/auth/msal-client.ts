import {
  BrowserAuthError,
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AuthenticationResult,
} from '@azure/msal-browser';

import { isEntraConfiguredOnWeb, loginRequest, msalConfig } from './auth-config.js';

let msalInstance: PublicClientApplication | null = null;
let initPromise: Promise<PublicClientApplication> | null = null;
let interactiveInFlight = false;

/** One-time MSAL init; must complete before any login/token call. */
export async function getMsalClient(): Promise<PublicClientApplication> {
  if (!isEntraConfiguredOnWeb()) {
    throw new Error('Entra ID is not configured on the web app');
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    msalInstance ??= new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
    // Clears stale redirect/popup state — required before interactive APIs.
    await msalInstance.handleRedirectPromise();
    return msalInstance;
  })();

  return initPromise;
}

async function acquireTokenForAccount(
  msal: PublicClientApplication,
): Promise<AuthenticationResult | null> {
  const account = msal.getAllAccounts()[0];
  if (!account) return null;

  try {
    return await msal.acquireTokenSilent({ ...loginRequest, account });
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      return null;
    }
    throw err;
  }
}

/** Sign in via popup; serialised so only one MSAL interaction runs at a time. */
export async function loginInteractive(): Promise<AuthenticationResult> {
  if (interactiveInFlight) {
    throw new Error('Sign-in is already in progress. Please wait for the popup to finish.');
  }

  interactiveInFlight = true;
  try {
    const msal = await getMsalClient();
    await msal.handleRedirectPromise();

    const silent = await acquireTokenForAccount(msal);
    if (silent?.accessToken) {
      return silent;
    }

    try {
      return await msal.loginPopup(loginRequest);
    } catch (err) {
      if (err instanceof BrowserAuthError && err.errorCode === 'interaction_in_progress') {
        throw new Error(
          'Sign-in is already in progress. Close any Microsoft popup and try again in a few seconds.',
        );
      }
      throw err;
    }
  } finally {
    interactiveInFlight = false;
  }
}

export async function logoutInteractive(): Promise<void> {
  const msal = await getMsalClient();
  await msal.handleRedirectPromise();
  const account = msal.getAllAccounts()[0];
  if (!account) return;

  if (interactiveInFlight) return;

  interactiveInFlight = true;
  try {
    await msal.logoutPopup({ account });
  } finally {
    interactiveInFlight = false;
  }
}

/** Restore session on page load when an MSAL account already exists. */
export async function tryRestoreEntraSession(): Promise<string | null> {
  const msal = await getMsalClient();
  const result = await acquireTokenForAccount(msal);
  return result?.accessToken ?? null;
}
