import ProductPage from './ProductPage'

const isAssistantEnabled = Boolean(
  process.env.MCP_OAUTH2_CLIENT_ID &&
  process.env.MCP_OAUTH2_CLIENT_SECRET &&
  process.env.GRAM_API_KEY &&
  process.env.GOOGLE_GENERATIVE_AI_API_KEY &&
  process.env.ANTHROPIC_API_KEY,
)

export default function Page() {
  return <ProductPage isAssistantEnabled={isAssistantEnabled} />
}
