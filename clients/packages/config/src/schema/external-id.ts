import { Schema } from 'effect'

export const ExternalId = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, {
    message:
      'Use only letters, digits, "_", "-", "." and ":", starting with a letter or digit',
  }),
)
