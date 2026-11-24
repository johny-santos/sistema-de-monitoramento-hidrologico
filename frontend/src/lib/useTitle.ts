import { useEffect } from 'react'

/** Título da aba por tela (ajuda quem usa leitor de tela, o histórico e as abas abertas). */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · HidroMonitor` : 'HidroMonitor · Monitoramento Hidrológico'
  }, [title])
}
