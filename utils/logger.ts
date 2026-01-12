/**
 * Structured logging utility for error tracking and monitoring
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

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs in memory

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

    // Add to in-memory log
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output (can be replaced with external service in production)
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
      logMethod(prefix, message, { context, error });
    } else if (context) {
      logMethod(prefix, message, context);
    } else {
      logMethod(prefix, message);
    }

    // In production, you could send to external service:
    // this.sendToMonitoringService(entry);
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>) {
    if (import.meta.env.DEV) {
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
    
    // In production, send critical errors to monitoring service
    if (import.meta.env.PROD) {
      // Example: sendToSentry(error, { message, context });
      // Example: sendToLogRocket(error, { message, context });
    }
  }

  /**
   * Log API error with context
   */
  logApiError(operation: string, error: Error, context?: Record<string, unknown>) {
    this.error(`API Error in ${operation}`, error, {
      operation,
      ...context,
    });
  }

  /**
   * Log user action (for analytics, without PII)
   */
  logUserAction(action: string, metadata?: Record<string, unknown>) {
    // Remove any PII before logging
    const safeMetadata = this.sanitizeMetadata(metadata);
    this.info(`User action: ${action}`, safeMetadata);
  }

  /**
   * Sanitize metadata to remove PII
   */
  private sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!metadata) return undefined;

    const sensitiveKeys = ['apiKey', 'email', 'phone', 'password', 'token'];
    const sanitized = { ...metadata };

    sensitiveKeys.forEach((key) => {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Get recent logs (for debugging)
   */
  getRecentLogs(count: number = 10): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
  }
}

// Singleton instance
export const logger = new Logger();

/**
 * Error boundary helper to log React errors
 */
export const logReactError = (error: Error, errorInfo: React.ErrorInfo) => {
  logger.error('React Error Boundary caught error', error, {
    componentStack: errorInfo.componentStack,
  });
};


