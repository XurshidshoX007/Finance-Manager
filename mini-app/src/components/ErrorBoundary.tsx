import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
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
        <div className="p-4 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Xatolik yuz berdi</h2>
          <p className="text-[var(--tg-theme-hint-color)] mb-4">
            {this.state.error?.message || "Noma'lum xatolik"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] px-4 py-2 rounded-lg"
          >
            Qaytadan urinib ko'rish
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
