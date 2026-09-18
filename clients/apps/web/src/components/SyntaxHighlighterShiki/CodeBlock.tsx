'use client'

import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from './SyntaxHighlighterClient'

export const CodeBlock = ({
  code,
  lang = 'typescript',
}: {
  code: string
  lang?: 'typescript' | 'javascript' | 'bash' | 'python'
}) => (
  <pre className="dark:bg-polar-900 dark:border-polar-700 rounded-lg border border-gray-200 bg-white p-4 font-mono text-sm">
    <SyntaxHighlighterProvider>
      <SyntaxHighlighterClient lang={lang} code={code} />
    </SyntaxHighlighterProvider>
  </pre>
)
