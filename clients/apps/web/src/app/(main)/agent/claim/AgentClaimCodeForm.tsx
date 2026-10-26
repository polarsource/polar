import { Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const CLAIM_CODE_WORDS = 3

export const normalizeClaimCode = (code: string): string | null => {
  const words = code
    .trim()
    .toLowerCase()
    .split(/[\s\-_]+/)
    .filter((word) => word !== '')
  return words.length === CLAIM_CODE_WORDS &&
    words.every((word) => /^[a-z]+$/.test(word))
    ? words.join('-')
    : null
}

const AgentClaimCodeForm = ({
  id,
  code,
  error,
  onChange,
  onSubmit,
}: {
  id: string
  code: string
  error?: string
  onChange: (code: string) => void
  onSubmit: () => void
}) => {
  return (
    <Box
      as="form"
      id={id}
      flexDirection="column"
      rowGap="m"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <Input
        className="h-14 font-mono text-lg tracking-wide"
        aria-label="Claim code"
        placeholder="amber-river-lemon"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        value={code}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <Text color="danger">{error}</Text>}
    </Box>
  )
}

export default AgentClaimCodeForm
