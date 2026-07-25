'use client'

import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Children,
  PropsWithChildren,
  ReactNode,
  createContext,
  useContext,
} from 'react'
import { benefitsDisplayNames } from '../utils'

export const CompactCardContext = createContext(false)

export const HeroText = ({
  monospace,
  loading,
  placeholderText,
  children,
}: PropsWithChildren<{
  monospace?: boolean
  loading?: boolean
  placeholderText?: string
}>) => (
  <Text
    variant="heading-xxs"
    as="p"
    monospace={monospace}
    loading={loading}
    placeholderText={placeholderText}
    truncate
  >
    {children}
  </Text>
)

export const Fact = ({
  label,
  monospace,
  children,
}: PropsWithChildren<{ label: string; monospace?: boolean }>) => {
  const compact = useContext(CompactCardContext)
  return (
    <Box
      flexDirection="row"
      justifyContent={compact ? 'start' : 'between'}
      alignItems="baseline"
      columnGap="l"
      minWidth={0}
    >
      <Box flexShrink={0} width={compact ? 160 : undefined}>
        <Text color="muted">{label}</Text>
      </Box>
      <Box flex={1} minWidth={0} justifyContent={compact ? 'start' : 'end'}>
        {typeof children === 'string' ? (
          <Text monospace={monospace} truncate>
            {children}
          </Text>
        ) : (
          children
        )}
      </Box>
    </Box>
  )
}

export const FactList = ({ children }: { children: ReactNode }) => {
  const items = Children.toArray(children)
  return (
    <Box flexDirection="column" width="100%">
      {items.map((child, index) => (
        <Box
          key={index}
          flexDirection="column"
          minWidth={0}
          borderTopWidth={index === 0 ? 0 : 1}
          borderStyle="solid"
          borderColor="border-primary"
          paddingTop={index === 0 ? 'none' : 'm'}
          paddingBottom={index === items.length - 1 ? 'none' : 'm'}
        >
          {child}
        </Box>
      ))}
    </Box>
  )
}

export const CardBody = ({
  type,
  hero,
  body,
  facts,
}: {
  type: schemas['BenefitType']
  hero: ReactNode
  body: string
  facts: ReactNode
}) => {
  const compact = useContext(CompactCardContext)

  if (compact) {
    return (
      <Box
        flexDirection="column"
        justifyContent="center"
        rowGap="l"
        flexGrow={1}
        minWidth={0}
        padding="xl"
        borderLeftWidth={{ base: 0, md: 1 }}
        borderStyle="solid"
        borderColor="border-primary"
      >
        {typeof hero === 'string' ? <HeroText>{hero}</HeroText> : hero}
        {facts}
      </Box>
    )
  }

  return (
    <>
      <Box
        flexDirection="column"
        justifyContent="center"
        rowGap="m"
        flexGrow={1}
        minWidth={0}
        padding="2xl"
        borderLeftWidth={{ base: 0, md: 1 }}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Text color="accent">{benefitsDisplayNames[type]}</Text>
        {typeof hero === 'string' ? <HeroText>{hero}</HeroText> : hero}
        <Text color="muted">{body}</Text>
      </Box>
      <Box
        flexDirection="column"
        justifyContent="center"
        width={{ base: '100%', md: '34%' }}
        flexShrink={0}
        minWidth={0}
        padding="2xl"
        borderTopWidth={{ base: 1, md: 0 }}
        borderLeftWidth={{ base: 0, md: 1 }}
        borderStyle="solid"
        borderColor="border-primary"
      >
        {facts}
      </Box>
    </>
  )
}
