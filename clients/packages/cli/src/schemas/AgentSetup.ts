import { Data, Schema } from 'effect'

export const clients = ['claude-code', 'codex', 'cursor'] as const
export type Client = (typeof clients)[number]

export const skillScopes = ['project', 'global'] as const
export type SkillScope = (typeof skillScopes)[number]

export const ClientStatus = Schema.Struct({
  client: Schema.Literals(clients),
  name: Schema.String,
  detected: Schema.Boolean,
  installed: Schema.Boolean,
  version: Schema.optionalKey(Schema.String),
  problem: Schema.optionalKey(Schema.String),
})
export type ClientStatus = typeof ClientStatus.Type

export const SkillsStatus = Schema.Struct({
  scope: Schema.Literals(skillScopes),
  directory: Schema.String,
  state: Schema.Literals(['current', 'outdated', 'missing']),
  skills: Schema.Array(Schema.String),
})
export type SkillsStatus = typeof SkillsStatus.Type

export const SetupStep = Schema.Struct({
  target: Schema.Literals([...clients, 'skills']),
  name: Schema.String,
  outcome: Schema.Literals(['installed', 'updated', 'unchanged', 'failed']),
  detail: Schema.optionalKey(Schema.String),
})
export type SetupStep = typeof SetupStep.Type

export const AgentSetupResult = Schema.Struct({
  clients: Schema.Array(ClientStatus),
  skills: Schema.Array(SkillsStatus),
  steps: Schema.Array(SetupStep),
})
export type AgentSetupResult = typeof AgentSetupResult.Type

export class AgentSetupError extends Data.TaggedError('AgentSetupError')<{
  message: string
  hint?: string | undefined
}> {}
