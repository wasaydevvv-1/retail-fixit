import { useEffect } from 'react';

export const APP_NAME = 'RetailFixIt';

/** Updates the browser tab title (e.g. "Dispatch board · RetailFixIt"). */
export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME;
  }, [pageTitle]);
}
