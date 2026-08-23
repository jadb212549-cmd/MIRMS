import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React Component Tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    if (window.confirm('Clear cached application state and reload? (Your master records will reset to standard baseline defaults)')) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.warn('Failed clearing storage:', e);
      }
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-[#141414] border border-red-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-100">Application Error Detected</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  The system encountered an unexpected runtime error and prevented a blank screen.
                </p>
              </div>
            </div>

            <div className="bg-[#0D0D0D] border border-[#262626] rounded-xl p-4 text-xs font-mono text-red-300 max-h-48 overflow-y-auto">
              <div className="font-bold mb-1">
                {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unknown runtime error'}
              </div>
              {this.state.errorInfo?.componentStack && (
                <div className="text-[10px] text-gray-500 whitespace-pre-wrap mt-2">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                onClick={this.handleResetCache}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-[#222] hover:bg-[#2A2A2A] border border-[#333] rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-amber-400" />
                <span>Reset Cache & Defaults</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
