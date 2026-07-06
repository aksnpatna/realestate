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
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: '40px', textAlign: 'center'
        }}>
          <h2 style={{ marginBottom: '16px', color: 'var(--warning, #ef4444)' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '500px' }}>
            The app encountered an unexpected error. This may happen if data failed to load or the backend is unavailable.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              padding: '10px 24px', background: 'var(--accent-purple, #8b5cf6)', color: '#fff',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            Reload Page
          </button>
          {this.state.error && (
            <details style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <summary style={{ cursor: 'pointer' }}>Technical details</summary>
              <pre style={{ textAlign: 'left', whiteSpace: 'pre-wrap', marginTop: '8px' }}>
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
