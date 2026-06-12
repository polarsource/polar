'use client'

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { PropRow } from '@/components/docs'
import { Example, PageHeader, PropsTable, Section } from '@/components/docs'

const basicCode = `<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="secondary">Hover me</Button>
    </TooltipTrigger>
    <TooltipContent>Helpful context</TooltipContent>
  </Tooltip>
</TooltipProvider>`

const sidesCode = `<TooltipContent side="top">Top</TooltipContent>
<TooltipContent side="right">Right</TooltipContent>
<TooltipContent side="bottom">Bottom</TooltipContent>
<TooltipContent side="left">Left</TooltipContent>`

const providerProps: PropRow[] = [
  {
    name: 'delayDuration',
    type: 'number',
    default: '700',
    description: 'Delay in ms before a tooltip opens on hover.',
  },
  {
    name: 'skipDelayDuration',
    type: 'number',
    default: '300',
    description:
      'Window in ms during which moving between triggers skips the open delay.',
  },
  {
    name: 'children',
    type: 'ReactNode',
    description: 'The tree that may contain one or more tooltips.',
  },
]

const contentProps: PropRow[] = [
  {
    name: 'side',
    type: "'top' | 'right' | 'bottom' | 'left'",
    default: "'top'",
    description: 'Preferred side of the trigger to render against.',
  },
  {
    name: 'sideOffset',
    type: 'number',
    default: '4',
    description: 'Distance in px between the trigger and the content.',
  },
  {
    name: 'align',
    type: "'start' | 'center' | 'end'",
    default: "'center'",
    description: 'Alignment against the trigger along the chosen side.',
  },
  {
    name: 'className',
    type: 'string',
    description: 'Classes merged onto the content surface.',
  },
  {
    name: 'children',
    type: 'ReactNode',
    description: 'Tooltip content.',
  },
]

export default function TooltipPage() {
  return (
    <>
      <PageHeader
        title="Tooltip"
        description="A compound component built on Radix Tooltip. Wrap the tree in TooltipProvider, then compose Tooltip with TooltipTrigger and TooltipContent."
      />

      <Section
        title="Basic"
        description="Use asChild on the trigger to attach the tooltip to your own element. Content renders into a portal."
      >
        <Example code={basicCode}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>Helpful context</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Example>
      </Section>

      <Section
        title="Sides"
        description="The side prop sets the preferred placement. Radix flips it automatically when there is not enough room."
      >
        <Example code={sidesCode}>
          <TooltipProvider delayDuration={150}>
            <Box alignItems="center" columnGap="m" flexWrap="wrap">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Top</Button>
                </TooltipTrigger>
                <TooltipContent side="top">Top</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Right</Button>
                </TooltipTrigger>
                <TooltipContent side="right">Right</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Bottom</Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Bottom</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Left</Button>
                </TooltipTrigger>
                <TooltipContent side="left">Left</TooltipContent>
              </Tooltip>
            </Box>
          </TooltipProvider>
        </Example>
      </Section>

      <Section
        title="Anatomy"
        description="TooltipProvider, Tooltip and TooltipTrigger re-export the Radix primitives unchanged. TooltipContent wraps the Radix content in a portal with default surface styling and a four pixel offset."
      >
        <PropsTable rows={providerProps} />
      </Section>

      <Section
        title="TooltipContent props"
        description="Forwarded to the Radix content. The most common props are listed."
      >
        <PropsTable rows={contentProps} />
      </Section>
    </>
  )
}
