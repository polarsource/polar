import { Terminal } from '../Terminal'

const CODE = `import { Ingestion } from "@polar-sh/ingestion";
import { LLMStrategy } from "@polar-sh/ingestion/strategies/LLM";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const llmIngestion = Ingestion({ accessToken: 'xxx' })
  .strategy(new LLMStrategy(openai("gpt-4o")))
  .ingest("openai-usage");

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const model = llmIngestion.client({
    externalCustomerId: "user_123",
  });

  const { text } = await generateText({
    model,
    system: "You are a helpful assistant.",
    prompt,
  });

  return Response.json({ text });
}`

export const Ingestion = () => {
  return (
    <Terminal
      className="row-span-2"
      title="terminal"
      subtitle="api/ai/route.ts"
      content={CODE}
      footer={[
        {
          command: 'curl -X POST https://api.example.com/endpoint \\',
          type: 'input',
        },
        {
          command: '-H "Content-Type: application/json" \\',
          type: 'output',
        },
        {
          command: `-d '{"prompt": "Do your magic"}'`,
          type: 'output',
        },
      ]}
    />
  )
}
