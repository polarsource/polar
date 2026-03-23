'use client'

import { SyntaxHighlighterClient } from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { twMerge } from 'tailwind-merge'

// Mirror the keys accepted by SyntaxHighlighterClient (LANGUAGE_MAP is not exported)
type Lang = 'typescript' | 'js' | 'javascript' | 'bash' | 'python'

export type TerminalFooterItem = {
  command: string
  type: 'input' | 'output'
}

type TerminalProps = {
  className?: string
  title: string
  subtitle: string
  content: string
  lang?: Lang
  footer: TerminalFooterItem[]
}

export const Terminal = ({
  className,
  title,
  subtitle,
  content,
  lang = 'typescript',
  footer,
}: TerminalProps) => {
  // Cast is safe: our Lang union mirrors LANGUAGE_MAP keys exactly
  const resolvedLang = lang as Parameters<
    typeof SyntaxHighlighterClient
  >[0]['lang']

  return (
    <div
      className={twMerge(
        'dark:border-polar-700 flex flex-1 flex-col rounded-2xl border border-gray-100 bg-gray-50 p-1 dark:bg-transparent',
        className,
      )}
    >
      {/* Title bar */}
      <div className="flex flex-row items-center gap-x-4 px-4 py-3 font-mono text-sm">
        <span>{title}</span>
        <span className="dark:text-polar-500 text-gray-500">nvim</span>
        <span className="dark:text-polar-500 text-gray-500">{subtitle}</span>
      </div>

      {/* Code body */}
      <div className="dark:bg-polar-900 z-1 flex-1 rounded-xl bg-white p-4 text-sm shadow-xs">
        <SyntaxHighlighterClient lang={resolvedLang} code={content} />
      </div>

      {/* Footer commands */}
      <div className="flex flex-col gap-y-1 px-4 py-3">
        {footer.map((item, i) =>
          item.type === 'input' ? (
            <div key={i} className="flex flex-row gap-x-4 font-mono text-sm">
              <span>{item.command}</span>
            </div>
          ) : (
            <div
              key={i}
              className="dark:text-polar-500 flex flex-row gap-x-4 font-mono text-sm text-gray-500"
            >
              <span>{item.command}</span>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
