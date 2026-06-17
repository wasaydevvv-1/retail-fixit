import { ApiClientError } from '../lib/api-client.js';
import { friendlyUserMessage } from '../lib/user-messages.js';

interface ErrorAlertProps {
  error: unknown;
  title?: string;
  /** Show technical error code (off by default for end users). */
  showCode?: boolean;
}

function getErrorDetails(error: unknown): { message: string; code?: string } {
  if (error instanceof ApiClientError) {
    return { message: friendlyUserMessage(error.message), code: error.code };
  }
  if (error instanceof Error) {
    return { message: friendlyUserMessage(error.message) };
  }
  return { message: 'Something went wrong. Please try again.' };
}

export function ErrorAlert({
  error,
  title = 'Something went wrong',
  showCode = false,
}: ErrorAlertProps) {
  const { message, code } = getErrorDetails(error);

  return (
    <div className="error-alert" role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
      {showCode && code && <p className="hint">Reference: {code}</p>}
    </div>
  );
}
