// @ts-ignore
import mermaid from 'mermaid'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useRef, useState } from 'react'

interface BrowserMermaidProps {
  graphDefinition: string
}
export const BrowserMermaid: React.FC<BrowserMermaidProps> = ({
  graphDefinition,
}) => {
  const { resolvedTheme } = useTheme()
  const divRef = useRef<HTMLDivElement>(null)
  const [syntaxError, setSyntaxError] = useState<string | null>(null)

  const drawDiagram = useCallback(async () => {
    if (divRef.current) {
      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      })
      try {
        const { svg } = await mermaid.render(
          // Random ID to make sure graph is re-rendered in strict mode
          `mermaid-${Math.random().toString().replace('.', '')}`,
          graphDefinition,
        )
        divRef.current.innerHTML = svg
      } catch (err) {
        setSyntaxError((err as any).message)
      }
    }
  }, [divRef, graphDefinition, resolvedTheme])

  useEffect(() => {
    drawDiagram()
  }, [drawDiagram])

  return syntaxError ? (
    <pre>{syntaxError}</pre>
  ) : (
    <div
      ref={divRef}
      className="flex w-[2000px] max-w-full items-center justify-center"
    ></div>
  )
}

export default BrowserMermaid
