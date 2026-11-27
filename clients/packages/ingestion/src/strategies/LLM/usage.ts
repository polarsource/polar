export type Usage = {
  inputTokens?: number | undefined
  outputTokens?: number | undefined
  totalTokens?: number | undefined
  cachedInputTokens?: number | undefined
}

export type Identity = { vendor: string; model: string }

export type Ingest = (
  identity: Identity,
  usage: Usage | undefined,
) => Promise<void>
