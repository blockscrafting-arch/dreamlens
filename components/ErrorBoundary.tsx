import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/Button';
import { logReactError } from '../utils/logger';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React errors and display fallback UI
 * Prevents the entire app from crashing when a component throws an error
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error using structured logger
    logReactError(error, errorInfo);

    // Send error to Sentry with additional context
    if (import.meta.env.PROD) {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          errorBoundary: true,
        },
      });
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-cream flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-3xl p-8 shadow-2xl text-center">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">⚠️</span>
            </div>
            
            <h1 className="text-3xl font-serif font-bold text-gray-900 mb-4">
              Что-то пошло не так
            </h1>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              Произошла неожиданная ошибка. Не волнуйтесь, ваши данные в безопасности.
            </p>

            {this.state.error && (
              <div className="mb-6 text-left bg-gray-50 rounded-xl p-4 border border-gray-200">
                {import.meta.env.DEV ? (
                  <details>
                    <summary className="cursor-pointer text-sm font-bold text-gray-700 mb-2">
                      Детали ошибки (только в режиме разработки)
                    </summary>
                    <pre className="text-xs text-red-600 overflow-auto max-h-48 mt-2">
                      {this.state.error.toString()}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                ) : (
                  <div className="text-sm text-gray-600">
                    <p className="font-semibold mb-2">Код ошибки:</p>
                    <p className="font-mono text-xs bg-white p-2 rounded border">
                      {this.state.error.name}: {this.state.error.message}
                    </p>
                    <p className="mt-3 text-xs text-gray-500">
                      Ошибка была автоматически отправлена в систему мониторинга.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={this.handleReset} variant="secondary">
                Попробовать снова
              </Button>
              <Button onClick={this.handleReload} className="bg-gray-900 text-white hover:bg-gray-800">
                Перезагрузить страницу
              </Button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Если проблема повторяется, обновите страницу или попробуйте зайти позже.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

