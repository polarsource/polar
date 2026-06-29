from dataclasses import dataclass


@dataclass(frozen=True)
class SeedCompany:
    slug: str
    name: str
    category: str
    pricing_url: str
    summary: str | None = None


# Initial set of companies to track. Base URLs are intentional — the scraper's
# fetch_and_extract falls back to `<url>/pricing` when a homepage has no plans.
# Extend this list (or move it to the DB / an admin UI) as the directory grows.
SEED_COMPANIES: list[SeedCompany] = [
    # AI
    SeedCompany("openai", "OpenAI", "AI", "https://openai.com"),
    SeedCompany("anthropic", "Anthropic", "AI", "https://anthropic.com"),
    SeedCompany("mistral", "Mistral AI", "AI", "https://mistral.ai"),
    SeedCompany("cohere", "Cohere", "AI", "https://cohere.com"),
    SeedCompany("perplexity", "Perplexity", "AI", "https://perplexity.ai"),
    SeedCompany("huggingface", "Hugging Face", "AI", "https://huggingface.co"),
    SeedCompany("replicate", "Replicate", "AI", "https://replicate.com"),
    SeedCompany("together", "Together AI", "AI", "https://together.ai"),
    SeedCompany("fireworks", "Fireworks AI", "AI", "https://fireworks.ai"),
    SeedCompany("elevenlabs", "ElevenLabs", "AI", "https://elevenlabs.io"),
    SeedCompany("runway", "Runway", "AI", "https://runwayml.com"),
    SeedCompany("groq", "Groq", "AI", "https://groq.com"),
    # Infrastructure
    SeedCompany("vercel", "Vercel", "Infrastructure", "https://vercel.com"),
    SeedCompany("netlify", "Netlify", "Infrastructure", "https://netlify.com"),
    SeedCompany("render", "Render", "Infrastructure", "https://render.com"),
    SeedCompany("fly", "Fly.io", "Infrastructure", "https://fly.io"),
    SeedCompany("railway", "Railway", "Infrastructure", "https://railway.app"),
    SeedCompany("modal", "Modal", "Infrastructure", "https://modal.com"),
    SeedCompany("cloudflare", "Cloudflare", "Infrastructure", "https://cloudflare.com"),
    SeedCompany(
        "digitalocean",
        "DigitalOcean",
        "Infrastructure",
        "https://digitalocean.com",
    ),
    SeedCompany("heroku", "Heroku", "Infrastructure", "https://heroku.com"),
    SeedCompany("vultr", "Vultr", "Infrastructure", "https://vultr.com"),
    SeedCompany("linode", "Linode", "Infrastructure", "https://linode.com"),
    SeedCompany("scaleway", "Scaleway", "Infrastructure", "https://scaleway.com"),
    # Developer Tools
    SeedCompany("cursor", "Cursor", "Developer Tools", "https://cursor.com"),
    SeedCompany("github", "GitHub", "Developer Tools", "https://github.com"),
    SeedCompany("gitlab", "GitLab", "Developer Tools", "https://gitlab.com"),
    SeedCompany("postman", "Postman", "Developer Tools", "https://postman.com"),
    SeedCompany("sentry", "Sentry", "Developer Tools", "https://sentry.io"),
    SeedCompany("circleci", "CircleCI", "Developer Tools", "https://circleci.com"),
    SeedCompany("replit", "Replit", "Developer Tools", "https://replit.com"),
    SeedCompany(
        "sourcegraph",
        "Sourcegraph",
        "Developer Tools",
        "https://sourcegraph.com",
    ),
    SeedCompany("jetbrains", "JetBrains", "Developer Tools", "https://jetbrains.com"),
    SeedCompany("docker", "Docker", "Developer Tools", "https://docker.com"),
    SeedCompany("retool", "Retool", "Developer Tools", "https://retool.com"),
    # Data
    SeedCompany("supabase", "Supabase", "Data", "https://supabase.com"),
    SeedCompany("planetscale", "PlanetScale", "Data", "https://planetscale.com"),
    SeedCompany("snowflake", "Snowflake", "Data", "https://snowflake.com"),
    SeedCompany("databricks", "Databricks", "Data", "https://databricks.com"),
    SeedCompany("mongodb", "MongoDB", "Data", "https://mongodb.com"),
    SeedCompany("neon", "Neon", "Data", "https://neon.tech"),
    SeedCompany("pinecone", "Pinecone", "Data", "https://pinecone.io"),
    SeedCompany("confluent", "Confluent", "Data", "https://confluent.io"),
    # Productivity
    SeedCompany("linear", "Linear", "Productivity", "https://linear.app"),
    SeedCompany("notion", "Notion", "Productivity", "https://notion.so"),
    SeedCompany("slack", "Slack", "Productivity", "https://slack.com"),
    SeedCompany("figma", "Figma", "Productivity", "https://figma.com"),
    SeedCompany("airtable", "Airtable", "Productivity", "https://airtable.com"),
    SeedCompany("asana", "Asana", "Productivity", "https://asana.com"),
    SeedCompany("clickup", "ClickUp", "Productivity", "https://clickup.com"),
]
