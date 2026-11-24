import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; resetKey: string }
interface State { error: Error | null; key: string }

/** Rede de segurança da tela: um erro de renderização mostra um aviso com saída, nunca uma tela branca. */
export default class RouteBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: Error) { return { error } }

  // Ao trocar de rota, tenta renderizar de novo.
  static getDerivedStateFromProps(props: Props, state: State) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }

  componentDidCatch(error: Error) { console.error('[tela] erro de renderização:', error) }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="state error crash" role="alert">
        <AlertTriangle size={32} />
        <strong>Algo deu errado ao exibir esta tela.</strong>
        <span>Os dados recebidos podem estar incompletos. Tente de novo ou volte ao início.</span>
        <div className="crash-actions">
          <button className="btn-primary" onClick={() => this.setState({ error: null })}><RotateCcw size={16} /> Tentar novamente</button>
          <a className="btn-ghost" href="/"><Home size={16} /> Ir para o início</a>
        </div>
      </div>
    )
  }
}
