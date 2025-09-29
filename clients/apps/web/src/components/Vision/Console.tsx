import { twMerge } from 'tailwind-merge'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '../SyntaxHighlighterShiki/SyntaxHighlighterClient'

export interface ConsoleProps {
  className?: string
  title?: string
  input?: string
  output?: string
  code?: string
}

export const Console = ({
  className,
  code,
  title,
  input,
  output,
}: ConsoleProps) => {
  return (
    <div
      className={twMerge(
        'relative flex h-auto w-full flex-col md:w-auto md:self-start',
        className,
      )}
    >
      <div className="border-polar-200 bg-polar-900 relative w-full border-2">
        <div className="bg-polar-200 flex flex-row justify-between px-2 py-1 text-xs text-black">
          <span className="font-bold">{title ?? 'Terminal'}</span>
          <span className="mb-1 h-0.5 w-2 self-end bg-black" />
        </div>
        <div className="flex flex-col overflow-auto p-4 font-mono text-sm">
          {code ? (
            <SyntaxHighlighterProvider>
              <SyntaxHighlighterClient
                lang="js"
                code={code}
                customThemeConfig={{ light: 'poimandres', dark: 'poimandres' }}
              />
            </SyntaxHighlighterProvider>
          ) : (
            <pre className="flex flex-col gap-y-2 pb-4">
              <code>{input}</code>
              <code className="text-polar-500">{output}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
