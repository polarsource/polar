import type { McpServer } from '@modelcontextprotocol/server'
import { Effect, Schema } from 'effect'
import { intentField } from '../intent'
import { RequestLog } from '../log'
import { redact } from '../redact'
import { makeToolRunner } from '../results'

const DESCRIPTION = `Send feedback about Polar, its MCP tools or its documentation to Polar.

Use this for a confusing or broken experience, an unhelpful error, a missing capability, a useful improvement, or something that worked especially well. Keep the summary to one sentence. Never include any user or customer data in any feedback field: personal information, secrets, tokens, prompts, source code, query results, customer names or order data. Submitting feedback does not finish the user's task; continue the task afterward.`

export const Feedback = Schema.Struct({
  feedback_type: Schema.Literals(['product', 'mcp', 'docs', 'other']).annotate({
    description: 'Which Polar surface the feedback concerns.',
  }),
  sentiment: Schema.Literals([
    'positive',
    'neutral',
    'negative',
    'mixed',
  ]).annotate({ description: 'Overall tone of the experience.' }),
  summary: Schema.String.check(Schema.isMaxLength(200)).annotate({
    description:
      'One-sentence description of the feedback, without user or customer data.',
  }),
  category: Schema.optionalKey(
    Schema.Literals([
      'tool_correctness',
      'tool_description',
      'input_schema',
      'output_format',
      'error_message',
      'missing_capability',
      'instructions',
      'performance',
      'usability',
      'other',
    ]).annotate({
      description: 'The kind of issue or improvement, when one category fits.',
    }),
  ),
  details: Schema.optionalKey(
    Schema.String.check(Schema.isMaxLength(2000)).annotate({
      description: 'Concise context without user or customer data.',
    }),
  ),
  suggested_improvement: Schema.optionalKey(
    Schema.String.check(Schema.isMaxLength(1000)).annotate({
      description: 'A concrete change, without user or customer data.',
    }),
  ),
})

export type Feedback = typeof Feedback.Type

export const registerFeedbackTool = Effect.fn('registerFeedbackTool')(
  function* (server: McpServer) {
    const runTool = yield* makeToolRunner
    server.registerTool(
      'feedback',
      {
        title: 'Send feedback to Polar',
        description: DESCRIPTION,
        inputSchema: Schema.Struct({ ...Feedback.fields, ...intentField }).pipe(
          Schema.toStandardSchemaV1,
          Schema.toStandardJSONSchemaV1,
        ),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      ({ intent: _intent, ...feedback }, context) =>
        runTool(
          Effect.gen(function* () {
            const log = yield* RequestLog
            log.feedback = {
              ...feedback,
              summary: redact(feedback.summary),
              ...(feedback.details !== undefined && {
                details: redact(feedback.details),
              }),
              ...(feedback.suggested_improvement !== undefined && {
                suggested_improvement: redact(feedback.suggested_improvement),
              }),
            }
            return 'Thanks, your feedback was sent to Polar. Continue the task.'
          }),
          context.mcpReq.signal,
        ),
    )
  },
)
