import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Field } from './EventDetailField'

const formatCount = (count: number) =>
  new Intl.NumberFormat('en-US').format(count)

export const EventLLMFields = ({ llm }: { llm: schemas['LLMMetadata'] }) => (
  <Box flexDirection="column">
    <Field label="Model">
      <Text truncate>{llm.model}</Text>
    </Field>
    <Field label="Vendor">
      <Text truncate>{llm.vendor}</Text>
    </Field>
    <Field label="Input">
      <Text tabularNums>{formatCount(llm.input_tokens)}</Text>
    </Field>
    {llm.cached_input_tokens ? (
      <Field label="Cached">
        <Text tabularNums>{formatCount(llm.cached_input_tokens)}</Text>
      </Field>
    ) : null}
    <Field label="Output">
      <Text tabularNums>{formatCount(llm.output_tokens)}</Text>
    </Field>
    <Field label="Total">
      <Text tabularNums>{formatCount(llm.total_tokens)}</Text>
    </Field>
  </Box>
)
