import { ApiClientError } from './api-client.js';

/** Turn API / infrastructure errors into copy suitable for end users. */
export function friendlyUserMessage(message: string): string {
  const m = message.trim();
  if (!m) return 'Something went wrong. Please try again.';

  const lower = m.toLowerCase();

  if (lower.includes('not a valid reference update') || lower.includes('attempted role id')) {
    return 'The account was created. Microsoft sign-in access may take a minute to finish — share the credentials above; the user can sign in once ready.';
  }
  if (
    lower.includes('azure_ad') ||
    lower.includes('user.readwrite') ||
    lower.includes('admin consent') ||
    lower.includes('graph') ||
    lower.includes('entra')
  ) {
    return 'Account setup is not complete on the server. Contact your platform administrator.';
  }
  if (lower.includes('applicationinsights') || lower.includes('log analytics')) {
    return 'Cloud monitoring is not enabled for this environment.';
  }
  if (lower.includes('admin_slot_taken')) {
    return 'This tenant already has an administrator. Only one admin is allowed per tenant.';
  }
  if (lower.includes('access_not_assigned')) {
    return 'You do not have access yet. Ask an administrator to invite you.';
  }
  if (lower.includes('forbidden') || lower.includes('you do not have permission')) {
    return 'You do not have permission to do that.';
  }

  return m;
}

export function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) {
    return friendlyUserMessage(err.message);
  }
  if (err instanceof Error && err.message) {
    return friendlyUserMessage(err.message);
  }
  return fallback;
}

/** Human labels for observability metric keys shown in the admin health page. */
export const METRIC_LABELS: Record<string, string> = {
  http_request_duration_ms: 'Request speed',
  api_error_total: 'Errors',
  ai_latency_ms: 'AI response time',
  ai_success_total: 'AI recommendations',
  ai_fallback_total: 'Backup recommendations',
  ai_override_total: 'Manual vendor picks',
  ai_follow_total: 'AI picks accepted',
  event_publish_lag_ms: 'Event queue delay',
  event_handler_duration_ms: 'Background task time',
};
