import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="u-869e508f">
          <h2 className="u-7de39474">Something went wrong</h2>
          <p className="u-51ba052a">
            The app encountered an unexpected error. This may happen if data failed to load or the backend is unavailable.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="u-3ee40fda"
          >
            Reload Page
          </button>
          {this.state.error && (
            <details className="u-14bc528b">
              <summary className="u-62113f1d">Technical details</summary>
              <pre className="u-cd6e7aa1">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
