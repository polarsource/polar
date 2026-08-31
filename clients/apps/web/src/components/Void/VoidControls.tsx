'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, X } from 'lucide-react'
import { PropsWithChildren, useEffect, useState } from 'react'

export const VoidSettingRow = ({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) => (
  <Box
    justifyContent="between"
    alignItems={{ base: 'start', md: 'center' }}
    flexDirection={{ base: 'column', md: 'row' }}
    columnGap="3xl"
    rowGap="m"
  >
    <Box flexDirection="column" rowGap="xs" flex={1}>
      <Text variant="heading-xxs">{title}</Text>
      {description ? (
        <Text variant="heading-xxs" color="muted">
          {description}
        </Text>
      ) : null}
    </Box>
    {children}
  </Box>
)

export const VoidToggle = ({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="cursor-pointer border-0 bg-transparent p-0 disabled:cursor-default disabled:opacity-40"
  >
    <Box
      width={28}
      height={28}
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      alignItems="center"
      justifyContent="center"
      color={checked ? 'text-primary' : 'text-tertiary'}
      transitionProperty="colors"
      transitionDuration="fast"
      ease="decelerate"
    >
      {checked ? (
        <Check size={16} strokeWidth={2} />
      ) : (
        <X size={16} strokeWidth={2} />
      )}
    </Box>
  </button>
)

export const VoidSelect = ({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
}) => (
  <Box
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
    paddingBottom="xs"
  >
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="m-0 cursor-pointer appearance-none rounded-none border-0 bg-transparent p-0 text-lg text-black shadow-none ring-0 outline-none focus:shadow-none focus:ring-0 focus:outline-none focus-visible:outline-none disabled:cursor-default disabled:opacity-40 dark:text-white"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </Box>
)

export const VoidField = ({
  value,
  placeholder,
  onCommit,
  type = 'text',
  width = 280,
  disabled,
}: {
  value: string
  placeholder?: string
  onCommit: (value: string) => void
  type?: 'text' | 'number'
  width?: number | string
  disabled?: boolean
}) => {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const commit = () => {
    if (draft !== value) onCommit(draft)
  }

  return (
    <Box
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      paddingBottom="xs"
      width={width}
    >
      <input
        type={type}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
        className="m-0 w-full appearance-none rounded-none border-0 bg-transparent p-0 text-lg text-black caret-current shadow-none ring-0 outline-none placeholder:text-current placeholder:opacity-30 focus:shadow-none focus:ring-0 focus:outline-none focus-visible:outline-none disabled:opacity-40 dark:text-white"
      />
    </Box>
  )
}
