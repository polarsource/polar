import { dereference } from "@scalar/openapi-parser";
import fs from "fs/promises";
import path from "path";
import OpenAPISampler from "openapi-sampler";

async function processWebhook(
  eventName: string,
  webhook: any,
): Promise<{
  full: string;
  description: string;
  response: string;
}> {
  const schema = webhook.post || {};
  const body = schema.requestBody?.content?.["application/json"]?.schema;

  if (!body) return;

  const sample = OpenAPISampler.sample(body);

  const description = `${schema.description}`;
  const response = `
\`\`\`json
${JSON.stringify(sample, null, 2)}
\`\`\`
`;

  const full = `#### \`${eventName}\`

${description}

\`\`\`json Payload Sample [expandable]
${JSON.stringify(sample, null, 2)}
\`\`\`
`;

  return {
    full,
    description,
    response,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error(
      "Usage: node generate-webhooks.mts <openapi.yaml path> <output directory>",
    );
    process.exit(1);
  }

  const [openapiPath, outputDir] = args;

  try {
    // Read and parse the OpenAPI spec
    const openapiContent = await fs.readFile(openapiPath, "utf-8");

    // Dereference the OpenAPI spec
    const dereferenced = await dereference(openapiContent);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Process each webhook
    const webhooks = dereferenced.schema.webhooks || {};
    for (const [eventName, webhook] of Object.entries(webhooks)) {
      const mdxContent = await processWebhook(eventName, webhook);

      const eventDir = path.join(outputDir, eventName);
      await fs.mkdir(eventDir, { recursive: true });

      const responsePath = path.join(eventDir, `response.mdx`);
      await fs.writeFile(responsePath, mdxContent.response, "utf-8");

      const descriptionPath = path.join(eventDir, `description.mdx`);
      await fs.writeFile(descriptionPath, mdxContent.description, "utf-8");

      const fullPath = path.join(eventDir, `full.mdx`);
      await fs.writeFile(fullPath, mdxContent.full, "utf-8");
      console.log(`Generated: ${responsePath}`);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Execute the main function
main();

export {};
