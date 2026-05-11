import React from "react";

interface State { hasError: boolean; msg?: string }

export class CobrarErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, msg: error.message };
  }

  componentDidCatch(error: Error) {
    console.error("Error en cobro:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          translate="no"
          className="notranslate fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="max-w-sm rounded-3xl bg-card p-6 text-center shadow-2xl">
            <div className="mb-3 text-4xl">⚠️</div>
            <p className="mb-4 font-bold">Ha ocurrido un error. Por favor, vuelve a intentarlo.</p>
            {this.state.msg && (
              <pre className="mb-4 max-h-32 overflow-auto rounded-md bg-muted p-2 text-left text-xs text-destructive">
                {this.state.msg}
              </pre>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, msg: undefined });
                this.props.onReset();
              }}
              className="w-full rounded-2xl bg-primary py-3 font-black text-primary-foreground"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
