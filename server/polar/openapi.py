from typing import TypedDict

from polar.config import settings


class OpenAPIParameters(TypedDict):
    title: str
    summary: str
    version: str
    description: str
    docs_url: str | None
    redoc_url: str | None


OPENAPI_PARAMETERS: OpenAPIParameters = {
    "title": "Polar API",
    "summary": "Polar HTTP and Webhooks API",
    "version": "0.1.0",
    "description": """
Welcome to the **Polar API** for [polar.sh](https://polar.sh).

This specification contains both the definitions of the Polar HTTP API and the Webhook API.

#### Authentication

Use a [Personal Access Token](https://polar.sh/settings) and send it in the `Authorization` header on the format `Bearer [YOUR_TOKEN]`.

#### Feedback

If you have any feedback or comments, reach out in the [Polar API-issue](https://github.com/polarsource/polar/issues/834), or reach out on the Polar Discord server.

We'd love to see what you've built with the API and to get your thoughts on how we can make the API better!

#### Connecting

The Polar API is online at `https://api.polar.sh`.
""",
    "docs_url": None if settings.is_production() else "/docs",
    "redoc_url": None if settings.is_production() else "/redoc",
}

IN_DEVELOPMENT_ONLY = settings.is_development()
