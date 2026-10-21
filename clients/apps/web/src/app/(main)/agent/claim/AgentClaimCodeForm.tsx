import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@polar-sh/ui/components/atoms/InputOTP'

export const CLAIM_CODE_LENGTH = 6

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
}) => (
  <Box
    as="form"
    id={id}
    flexDirection="column"
    alignItems="center"
    rowGap="m"
    onSubmit={(event) => {
      event.preventDefault()
      onSubmit()
    }}
  >
    <Text variant="label">Enter the 6-digit code your agent gave you</Text>
    <InputOTP
      aria-label="Claim code"
      maxLength={CLAIM_CODE_LENGTH}
      pattern="^[0-9]+$"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      value={code}
      onChange={onChange}
    >
      <InputOTPGroup>
        {Array.from({ length: CLAIM_CODE_LENGTH }).map((_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="h-12 w-12 text-xl"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
    {error && (
      <Text color="danger" align="center">
        {error}
      </Text>
    )}
  </Box>
)

export default AgentClaimCodeForm
