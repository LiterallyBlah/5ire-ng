import * as Sentry from '@sentry/electron/main';
import log from 'electron-log';

export function init() {
  if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'development') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
    });
  }
}

export function captureException(error: Error | string) {
  log.error(error);
  if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'development') {
    Sentry.captureException(error);
  }
}

export function captureWarning(warning: any) {
  log.warn(warning);
  if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'development') {
    Sentry.captureMessage(warning, 'warning');
  }
}

export function debug(...messages: any[]) {
  log.debug(messages);
}

export function info(...messages: any[]) {
  log.info(...messages);
}

export function warn(...messages: any[]) {
  log.warn(...messages);
}

export function error(...messages: any[]) {
  log.error(...messages);
}
