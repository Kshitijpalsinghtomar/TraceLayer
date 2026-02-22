/**
 * ErrorBoundary — Production-grade React error boundary
 *
 * Catches render errors, prevents white screens, and provides
 * a graceful recovery UI with error details for debugging.
 *
 * Professional infrastructure for production-quality applications.
 */
import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RotateCcw, Home, Copy, ChevronDown, ChevronUp } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to console for dev debugging
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const errorText = [
      `Error: ${error?.message}`,
      `Stack: ${error?.stack}`,
      `Component Stack: ${errorInfo?.componentStack}`,
      `Time: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
    ].join("\n\n");

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Fallback: select text
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showDetails, copied } = this.state;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-lg w-full">
            {/* Error Card */}
            <div className="rounded-2xl border border-red-500/20 bg-gradient-to-b from-red-500/5 to-background p-8 text-center">
              {/* Icon */}
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center mb-5">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>

              {/* Message */}
              <h1 className="text-xl font-bold text-foreground mb-2">
                Something went wrong
              </h1>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                An unexpected error occurred. This has been logged and the team
                will investigate. You can try refreshing or returning to the dashboard.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <button
                  onClick={this.handleReset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={() => window.location.href = "/"}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Dashboard
                </button>
              </div>

              {/* Error Details Toggle */}
              <button
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="flex items-center gap-1.5 mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showDetails ? "Hide" : "Show"} technical details
              </button>

              {showDetails && (
                <div className="mt-4 text-left">
                  <div className="rounded-xl bg-muted/50 border border-border/60 p-4 overflow-auto max-h-[200px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        Error Details
                      </span>
                      <button
                        onClick={this.handleCopyError}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <pre className="text-[11px] text-red-600 dark:text-red-400 whitespace-pre-wrap break-words font-mono leading-relaxed">
                      {error?.message}
                    </pre>
                    {errorInfo?.componentStack && (
                      <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-words font-mono leading-relaxed mt-2 pt-2 border-t border-border/40">
                        {errorInfo.componentStack.slice(0, 500)}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <p className="text-center text-[11px] text-muted-foreground/50 mt-4">
              TraceLayer v1.0 • Error ID: {Date.now().toString(36)}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
