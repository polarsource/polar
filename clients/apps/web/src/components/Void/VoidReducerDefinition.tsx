import { Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { Fragment, ReactNode } from 'react'
import { clauseProperty, OPERATOR_GLYPH, splitFilter } from './reducerCode'
import {
  isClause,
  ReducerFilter,
  ReducerFilterClause,
  reducerHref,
  type VoidReducerDefinition as Reducer,
} from './reducers'

const Token = ({ children }: { children: ReactNode }) => (
  <Pill color="gray">
    <Text as="span" monospace variant="caption" color="inherit">
      {children}
    </Text>
  </Pill>
)

const Word = ({ children }: { children: ReactNode }) => (
  <Text as="span" color="muted" variant="caption">
    {children}
  </Text>
)

const Step = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box
    alignItems="baseline"
    columnGap="xl"
    paddingVertical="m"
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-secondary"
  >
    <Box width="4.5rem" flexShrink={0}>
      <Text as="span" monospace variant="caption" color="muted">
        {label}
      </Text>
    </Box>
    <Box alignItems="center" columnGap="s" rowGap="s" flexWrap="wrap">
      {children}
    </Box>
  </Box>
)

const Clause = ({ clause }: { clause: ReducerFilterClause }) => (
  <>
    <Token>{clauseProperty(clause.property)}</Token>
    <Word>{OPERATOR_GLYPH[clause.operator]}</Word>
    <Token>{String(clause.value)}</Token>
  </>
)

const Where = ({ filter }: { filter: ReducerFilter }) => (
  <>
    {filter.clauses.map((entry, index) => (
      <Fragment key={index}>
        {index > 0 ? <Word>{filter.conjunction}</Word> : null}
        {isClause(entry) ? (
          <Clause clause={entry} />
        ) : (
          <>
            <Word>(</Word>
            <Where filter={entry} />
            <Word>)</Word>
          </>
        )}
      </Fragment>
    ))}
  </>
)

const YIELDS: Record<Reducer['type'], string> = {
  scalar: 'one number per identity',
  dict: 'one record per identity',
}

const Fold = ({ reducer, base }: { reducer: Reducer; base: string }) => {
  const { func, property, expression, inputs } = reducer.aggregation
  if (func === 'derive') {
    return (
      <>
        <Step label="inputs">
          {Object.entries(inputs ?? {}).map(([name, slug]) => (
            <Fragment key={name}>
              {name === slug ? null : (
                <>
                  <Token>{name}</Token>
                  <Word>from</Word>
                </>
              )}
              <Link href={reducerHref(base, slug)}>
                <Token>{slug}</Token>
              </Link>
            </Fragment>
          ))}
        </Step>
        <Step label="derive">
          <Token>{expression}</Token>
        </Step>
      </>
    )
  }
  return (
    <Step label="fold">
      <Token>{func}</Token>
      {property ? (
        <>
          <Word>of</Word>
          <Token>{property}</Token>
        </>
      ) : (
        <Word>{func === 'count' ? 'matching events' : 'matching record'}</Word>
      )}
    </Step>
  )
}

const Pipeline = ({ reducer, base }: { reducer: Reducer; base: string }) => {
  const { on, where } = splitFilter(reducer.filter)
  const derived = reducer.aggregation.func === 'derive'
  return (
    <Box flexDirection="column">
      {derived ? null : (
        <Step label="on">
          {on.length > 0 ? (
            on.map((name) => <Token key={name}>{name}</Token>)
          ) : (
            <Word>every event</Word>
          )}
        </Step>
      )}
      {where ? (
        <Step label="where">
          <Where filter={where} />
        </Step>
      ) : null}
      {reducer.map ? (
        <Step label="map">
          {Object.entries(reducer.map).map(([key, value]) => (
            <Fragment key={key}>
              <Token>{key}</Token>
              <Word>=</Word>
              <Token>{String(value)}</Token>
            </Fragment>
          ))}
        </Step>
      ) : null}
      <Fold reducer={reducer} base={base} />
      <Step label="yields">
        <Token>{reducer.type}</Token>
        <Word>{YIELDS[reducer.type]}</Word>
      </Step>
    </Box>
  )
}

export const VoidReducerDefinition = ({
  reducer,
  base,
}: {
  reducer: Reducer
  base: string
}) => <Pipeline reducer={reducer} base={base} />
