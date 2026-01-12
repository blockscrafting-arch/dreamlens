/**
 * Server-side structured logging utility for API routes
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class ServerLogger {
  /**
   * Log a message with optional context
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context: context ? { ...context } : undefined,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };

    // Console output (structured for better parsing)
    const logMethod =
      level === LogLevel.ERROR
        ? console.error
        : level === LogLevel.WARN
        ? console.warn
        : level === LogLevel.DEBUG
        ? console.debug
        : console.log;

    const prefix = `[${level}] ${new Date(entry.timestamp).toISOString()}`;
    
    if (error) {
      logMethod(prefix, message, { context, error: { name: error.name, message: error.message, stack: error.stack } });
    } else if (context) {
      logMethod(prefix, message, context);
    } else {
      logMethod(prefix, message);
    }

    // In production, you could send to external service:
    // sendToMonitoringService(entry);
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'development') {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log API error with context
   */
  logApiError(operation: string, error: Error, context?: Record<string, unknown>) {
    // Enhanced error logging with structured context
    const errorContext: Record<string, unknown> = {
      operation,
      ...context,
    };

    // If error has additional context (ContextualError), include it
    if ('context' in error && typeof error.context === 'object') {
      errorContext.errorContext = error.context;
    }

    // Include request ID if available
    if (context?.requestId) {
      errorContext.requestId = context.requestId;
    }

    this.error(`API Error in ${operation}`, error, errorContext);
  }

  /**
   * Log API info with context
   */
  logApiInfo(operation: string, context?: Record<string, unknown>) {
    this.info(`API: ${operation}`, {
      operation,
      ...context,
    });
  }

  /**
   * Log API request with context
   */
  logApiRequest(operation: string, context?: Record<string, unknown>) {
    this.info(`API Request: ${operation}`, {
      operation,
      ...context,
    });
  }

}

// Singleton instance
export const logger = new ServerLogger();

// ESM default export to support import './logger.js'
export default logger;

