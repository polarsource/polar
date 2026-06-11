'use client'

import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { type CodeLang, useHighlightedCode } from '@/lib/shiki'

export function CodeBlock({
  code,
  lang = 'tsx',
}: {
  code: string
  lang?: CodeLang
}) {
  const [copied, setCopied] = useState(false)
  const highlighted = useHighlightedCode(code, lang)

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Box
      position="relative"
      backgroundColor="background-secondary"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      overflow="hidden"
    >
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        title="Copy code"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
          padding: 0,
        }}
      >
        <Box
          alignItems="center"
          justifyContent="center"
          width={30}
          height={30}
          borderRadius="s"
          color="text-tertiary"
          backgroundColor={{ hover: 'background-card' }}
          transitionProperty="colors"
          transitionDuration="fast"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </Box>
      </button>
      <Box
        as="span"
        display="block"
        overflowX="auto"
        padding="l"
        paddingRight="4xl"
        className="orbit-code"
      >
        {highlighted ? (
          <div dangerouslySetInnerHTML={{ __html: highlighted }} />
        ) : (
          <Text as="code" variant="mono" color="inherit">
            <pre style={{ margin: 0 }}>{code}</pre>
          </Text>
        )}
      </Box>
    </Box>
  )
}
