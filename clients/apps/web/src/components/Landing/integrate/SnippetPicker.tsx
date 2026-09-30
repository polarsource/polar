'use client'

import { StaticImage } from '@/components/Image/StaticImage'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useState } from 'react'
import { CodeLine } from './CodePanel'

export interface Snippet {
  name: string
  caption: string
  lines: string[]
  href?: string
}

interface SnippetPickerProps {
  snippets: Snippet[]
  backdrop: string
  actions?: boolean
}

/**
 * A full-width band in the style of the landing's MeterStream: a photo fills
 * the band and a single opaque card sits centered on top. The card holds the
 * snippet tabs, the code and the copy/docs actions. Every snippet is laid out
 * in the same grid cell so the card keeps the height of the tallest one.
 */
export const SnippetPicker = ({
  snippets,
  backdrop,
  actions = true,
}: SnippetPickerProps) => {
  const [index, setIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const snippet = snippets[index]

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    await navigator.clipboard.writeText(snippet.lines.join('\n'))
    setCopied(true)
  }

  return (
    <Box
      position="relative"
      width="100%"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      paddingHorizontal={{ base: 'l', md: '3xl' }}
      paddingVertical={{ base: '2xl', md: '4xl' }}
      minHeight={{ base: '20rem', md: '28rem' }}
      backgroundColor="background-secondary"
    >
      <StaticImage
        src={backdrop}
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
      />
      <Box
        position="relative"
        width="100%"
        maxWidth="42rem"
        minWidth={0}
        flexDirection="column"
        rowGap="xl"
        padding={{ base: 'l', md: 'xl' }}
        backgroundColor="background-primary"
        boxShadow="l"
      >
        {snippets.length > 1 ? (
          <Box as="ul" flexWrap="wrap" columnGap="l" rowGap="s">
            {snippets.map((s, i) => (
              <Box as="li" key={s.name}>
                <button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => {
                    setIndex(i)
                    setCopied(false)
                  }}
                >
                  <Box
                    color={{
                      base: i === index ? 'text-primary' : 'text-secondary',
                      hover: 'text-primary',
                    }}
                    transitionProperty="colors"
                    transitionDuration="fast"
                  >
                    <Text variant="default" color="inherit">
                      {s.name}
                    </Text>
                  </Box>
                </button>
              </Box>
            ))}
          </Box>
        ) : null}
        <Box display="grid" overflowX="auto">
          {snippets.map((s, i) => (
            <Box
              key={s.name}
              gridColumn="1"
              gridRow="1"
              flexDirection="column"
              rowGap="l"
              visibility={i === index ? 'visible' : 'hidden'}
              aria-hidden={i !== index}
            >
              <Text variant="default" color="muted" monospace>
                {s.caption}
              </Text>
              <Box flexDirection="column">
                {s.lines.map((line, j) => (
                  <CodeLine key={j} line={line} />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
        {actions ? (
          <Box columnGap="s" alignItems="center">
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            {snippet.href ? (
              <a href={snippet.href}>
                <Button size="sm" variant="ghost">
                  Docs
                </Button>
              </a>
            ) : null}
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
