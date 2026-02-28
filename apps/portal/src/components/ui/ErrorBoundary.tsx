import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * 全局错误边界 — 捕获渲染错误并显示优雅的降级 UI。
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
        // 未来接入 Sentry:
        // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="min-h-screen bg-[var(--color-surface-dim)] flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-[var(--color-surface)] rounded-2xl border border-[var(--color-outline)] shadow-lg p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-error-bg)] flex items-center justify-center">
                            <AlertTriangle className="text-[var(--color-error)]" size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                            出了点问题
                        </h2>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                            应用遇到了意外错误。您可以尝试重试或刷新页面。
                        </p>
                        {this.state.error && (
                            <details className="mb-4 text-left">
                                <summary className="text-xs text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text-primary)]">
                                    错误详情
                                </summary>
                                <pre className="mt-2 p-3 bg-[var(--color-surface-dim)] rounded-lg text-xs text-[var(--color-error)] overflow-auto max-h-40 whitespace-pre-wrap break-all">
                                    {this.state.error.message}
                                    {this.state.error.stack && `\n\n${this.state.error.stack}`}
                                </pre>
                            </details>
                        )}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleRetry}
                                className="btn btn-outlined h-10 px-4 text-sm"
                            >
                                <RefreshCw size={14} className="mr-1.5" />
                                重试
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="btn btn-filled h-10 px-4 text-sm"
                            >
                                刷新页面
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
