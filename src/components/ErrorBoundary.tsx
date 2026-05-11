import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info);
    this.setState({ error, info: info.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 16,
            fontFamily: "monospace",
            fontSize: 12,
            background: "#111",
            color: "#fff",
            minHeight: "100vh",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <h2 style={{ color: "#ff6b6b", marginBottom: 12 }}>App crashed</h2>
          <div style={{ marginBottom: 12 }}>
            <strong>{this.state.error.name}:</strong> {this.state.error.message}
          </div>
          {this.state.error.stack && (
            <details open>
              <summary>stack</summary>
              {this.state.error.stack}
            </details>
          )}
          {this.state.info && (
            <details>
              <summary>component stack</summary>
              {this.state.info}
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 4,
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
