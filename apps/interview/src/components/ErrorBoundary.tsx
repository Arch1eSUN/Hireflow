import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Interview 端全局错误边界。
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
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[var(--color-surface-dim)] flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-[var(--color-surface)] rounded-2xl border border-[var(--color-outline)] shadow-lg p-8 text-center">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--color-error-bg)] flex items-center justify-center">
                            <AlertTriangle className="text-[var(--color-error)]" size={28} />
                        </div>
                        <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
                            页面遇到问题
                        </h2>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-5">
                            面试过程中遇到了意外错误。请刷新页面重试。
                        </p>
                        <button
                            onClick={this.handleRetry}
                            className="btn btn-filled h-10 px-5 text-sm"
                        >
                            <RefreshCw size={14} className="mr-1.5" />
                            重试
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
