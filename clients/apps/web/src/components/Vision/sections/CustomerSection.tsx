import Image from "next/image";

import { Console } from "../Console";
import { Section } from "../Section";

export const CustomerSection = ({ active }: { active: boolean }) => {
	return (
		<Section
			active={active}
			header={{ index: "01", name: "Event Ingestion" }}
			title="No more reconciliation. Just added power."
			context={
				<div className="flex flex-col gap-y-6 md:w-fit">
					<div className="flex flex-row items-center gap-x-6 p-4 border border-polar-600 w-full">
						<Image
							alt="Emil Widlund"
							className="h-12 w-12"
							width={48}
							height={48}
							src="/assets/vision/emil.jpg"
						/>
						<div className="flex flex-col gap-y-2">
							<div className="flex text-xs flex-row gap-x-4">
								<h3>Emil Widlund</h3>
								<span className="text-polar-500">
									{new Date("2025-01-13T08:22:13").toLocaleString("en-US")}
								</span>
							</div>
							<div className="flex flex-row items-center gap-x-3">
								<span className="px-2 bg-emerald-500 text-black text-xxs">
									openai-usage
								</span>
								<pre className="text-xs">{`{ promptTokens: 38, completionTokens: 152 }`}</pre>
							</div>
						</div>
					</div>
					<Console
						className="flex"
						title="Polar Ingestion SDK"
						code={`import { Ingestion } from '@polar-sh/ingestion';
import { LLMStrategy } from '@polar-sh/ingestion/strategies/LLM';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const llmIngestion = Ingestion({ accessToken: process.env.POLAR_ACCESS_TOKEN })
    .strategy(new LLMStrategy(openai('gpt-4o')))
    .ingest('openai-usage')

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  const model = llmIngestion.client(
    req.headers.get('X-Polar-Customer-Id')
  )

  const { text } = await generateText({
    model,
    system: 'You are a helpful assistant.',
    prompt,
  });

  return Response.json({ text });
}`}
					/>
				</div>
			}
		>
			<p>
				Billing is a critical part of your customer relationship, but only a
				part of it - it&apos;s the outcome vs. input.
			</p>
			<p>It&apos;s time for the next evolution.</p>
		</Section>
	);
};
