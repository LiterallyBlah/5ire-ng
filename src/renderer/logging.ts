import * as Sentry from '@sentry/electron/renderer';
import { init as reactInit } from '@sentry/react';

export function init() {
  if (window.envVars.SENTRY_DSN && window.envVars.NODE_ENV !== 'development') {
    Sentry.init(
      {
        dsn: window.envVars.SENTRY_DSN,
      },
      reactInit
    );
  }
}

export function captureException(error: unknown) {
  console.error(error);
  if (window.envVars.SENTRY_DSN && window.envVars.NODE_ENV !== 'development') {
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  }
}

export function captureWarning(warning: any) {
  console.warn(warning);
  if (window.envVars.SENTRY_DSN && window.envVars.NODE_ENV !== 'development') {
    Sentry.captureMessage(warning, 'warning');
  }
}

export function debug(...messages: any[]) {
  console.debug(messages);
}

export function info(...messages: any[]) {
  console.info(...messages);
}

export function warn(...messages: any[]) {
  console.warn(...messages);
}
