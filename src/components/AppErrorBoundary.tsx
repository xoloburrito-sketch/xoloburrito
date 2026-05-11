import React from "react";

interface S { error: Error | null }

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, S> {
  state: S = { error: null };
  static getDerivedStateFromError(e: Error): S { return { error: e }; }
  componentDidCatch(e: Error) { console.error("AppError:", e?.message); }

  reset = () => {
    this.setState({ error: null });
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          translate="no"
          className="notranslate fixed inset-0 z-[9999] flex items-center justify-center bg-background p-4"
        >
          <div className="max-w-md rounded-3xl bg-card p-6 text-center shadow-2xl">
            <div className="mb-3 text-4xl">⚠️</div>
            <h1 className="mb-2 text-xl font-black text-foreground">Algo salió mal</h1>
            <pre className="mb-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left text-xs text-destructive">
              {this.state.error.message}
            </pre>
            <button
              onClick={this.reset}
              className="w-full rounded-2xl bg-primary py-3 font-black text-primary-foreground"
            >
              Recargar app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
