import { Schema } from 'effect'
import { redact } from './redact'

export const INTENT_MAX_CHARS = 1024

const DESCRIPTION =
  'One short sentence stating the goal this call serves (why you are calling this tool, not what it does). Pass it on every call, and keep it the same while the goal is unchanged. Never include customer names, emails or IDs.'

const EXAMPLES = ['Set up usage-based billing for an API product']

export const intentField = {
  intent: Schema.optionalKey(
    Schema.String.check(Schema.isMaxLength(INTENT_MAX_CHARS)).annotate({
      description: DESCRIPTION,
      examples: EXAMPLES,
    }),
  ),
}

export const intentJsonSchema = {
  type: 'string',
  description: DESCRIPTION,
  examples: EXAMPLES,
  maxLength: INTENT_MAX_CHARS,
}

export const readIntent = (value: unknown) => {
  const intent = typeof value === 'string' ? value.trim() : ''
  return intent === '' ? undefined : redact(intent.slice(0, INTENT_MAX_CHARS))
}
