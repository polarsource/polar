'use client'

import { Button, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ReactNode, useCallback, useState } from 'react'
import { Chapter } from '../Landing/Chapter'
import { brandSections } from './brand'
import LogoIcon from './logos/LogoIcon'
import LogoLoader from './logos/LogoLoader'
import LogoReveal from './logos/LogoReveal'
import LogoType from './logos/LogoType'
import { LogoVideo } from './logos/LogoVideo'
import { LOGO_MARK_PATH } from './logos/paths'

const LOGO_ICON_SVG = `<svg width="310" height="310" viewBox="0 0 310 310" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="${LOGO_MARK_PATH}" fill="currentColor"/>
</svg>`

const Panel = ({
  inverse = false,
  caption,
  children,
}: {
  inverse?: boolean
  caption?: ReactNode
  children: ReactNode
}) => (
  <Box
    position="relative"
    aspectRatio="4 / 3"
    alignItems="center"
    justifyContent="center"
    backgroundColor={inverse ? 'background-inverse' : 'background-secondary'}
  >
    <Text as="span" color={inverse ? 'inverse' : 'default'}>
      {children}
    </Text>
    {caption ? (
      <Box position="absolute" bottom="l" left="l">
        <Text variant="caption" color={inverse ? 'inverse' : 'muted'}>
          {caption}
        </Text>
      </Box>
    ) : null}
  </Box>
)

export function LogoSection() {
  const [copied, setCopied] = useState(false)
  const [revealRun, setRevealRun] = useState(0)

  const copyIcon = useCallback(() => {
    navigator.clipboard.writeText(LOGO_ICON_SVG)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }, [])

  return (
    <Chapter
      id={brandSections[0].id}
      index={brandSections[0].index}
      name={brandSections[0].label}
      title="The mark, held constant"
      subtitle="Full white on dark, full black on light"
      description="The mark and wordmark are the fixed core of the identity. Never recolor, rotate or distort them. Keep clear space around the mark equal to its height, and never set it smaller than 16px."
      cta={
        <>
          <Button variant="secondary" onClick={copyIcon}>
            {copied ? 'Copied' : 'Copy mark SVG'}
          </Button>
          <Button variant="secondary" asChild>
            <a href="/assets/brand/polar_brand.zip" download>
              Download assets
            </a>
          </Button>
        </>
      }
    >
      <LogoVideo />
      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="l">
        <Panel>
          <LogoIcon size={88} />
        </Panel>
        <Panel inverse>
          <LogoIcon size={88} />
        </Panel>
        <Panel inverse>
          <LogoType width={240} />
        </Panel>
        <Panel>
          <LogoType width={240} />
        </Panel>
        <button type="button" onClick={() => setRevealRun((run) => run + 1)}>
          <Panel caption="Reveal. Click to replay">
            <LogoReveal key={revealRun} size={240} />
          </Panel>
        </button>
        <Panel inverse caption="Loading">
          <LogoLoader size={88} />
        </Panel>
      </Grid>
    </Chapter>
  )
}
