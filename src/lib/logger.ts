/**
 * Centralized logging utility
 * Provides structured logging with different levels and contexts
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = 'auth' | 'api' | 'client' | 'general';

interface LogEntry {
  level: LogLevel;
  context: LogContext;
  message: string;
  timestamp: string;
  data?: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(entry: LogEntry): string {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.context.toUpperCase()}]`;
    return `${prefix} ${entry.message}`;
  }

  private createLogEntry(
    level: LogLevel,
    context: LogContext,
    message: string,
    data?: unknown
  ): LogEntry {
    return {
      level,
      context,
      message,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  private log(entry: LogEntry): void {
    const formattedMessage = this.formatMessage(entry);

    // In production, you might want to send logs to an external service
    // For now, we'll use console with appropriate methods
    switch (entry.level) {
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formattedMessage, entry.data);
        }
        break;
      case 'info':
        console.info(formattedMessage, entry.data);
        break;
      case 'warn':
        console.warn(formattedMessage, entry.data);
        break;
      case 'error':
        console.error(formattedMessage, entry.data);
        break;
    }
  }

  debug(context: LogContext, message: string, data?: unknown): void {
    this.log(this.createLogEntry('debug', context, message, data));
  }

  info(context: LogContext, message: string, data?: unknown): void {
    this.log(this.createLogEntry('info', context, message, data));
  }

  warn(context: LogContext, message: string, data?: unknown): void {
    this.log(this.createLogEntry('warn', context, message, data));
  }

  error(context: LogContext, message: string, data?: unknown): void {
    this.log(this.createLogEntry('error', context, message, data));
  }
}

export const logger = new Logger();

// Convenience functions for specific contexts
export const authLogger = {
  debug: (message: string, data?: unknown) => logger.debug('auth', message, data),
  info: (message: string, data?: unknown) => logger.info('auth', message, data),
  warn: (message: string, data?: unknown) => logger.warn('auth', message, data),
  error: (message: string, data?: unknown) => logger.error('auth', message, data),
};

export const apiLogger = {
  debug: (message: string, data?: unknown) => logger.debug('api', message, data),
  info: (message: string, data?: unknown) => logger.info('api', message, data),
  warn: (message: string, data?: unknown) => logger.warn('api', message, data),
  error: (message: string, data?: unknown) => logger.error('api', message, data),
};

export const clientLogger = {
  debug: (message: string, data?: unknown) => logger.debug('client', message, data),
  info: (message: string, data?: unknown) => logger.info('client', message, data),
  warn: (message: string, data?: unknown) => logger.warn('client', message, data),
  error: (message: string, data?: unknown) => logger.error('client', message, data),
};