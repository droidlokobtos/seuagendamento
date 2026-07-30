import { Component, type ReactNode } from "react";

/**
 * Isola falhas de renderização de blocos secundários (ex.: Perfil Inteligente)
 * para que uma exceção não derrube o formulário inteiro.
 */
export class SafeBoundary extends Component<
  { children: ReactNode; label?: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error(`[SafeBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
          Não foi possível carregar {this.props.label ?? "esta informação"}. O restante do
          formulário continua funcionando normalmente.
        </p>
      );
    }
    return this.props.children;
  }
}
