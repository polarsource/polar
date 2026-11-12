"""Script to generate an OAuth2 client for our MCP server."""

import asyncio

from rich import print

from polar.auth.scope import SCOPES_SUPPORTED
from polar.kit.crypto import generate_token
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import OAuth2Client
from polar.postgres import create_async_engine

from .constants import (
    CLIENT_ID_PREFIX,
    CLIENT_REGISTRATION_TOKEN_PREFIX,
    CLIENT_SECRET_PREFIX,
)


async def create_client() -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        client_secret = generate_token(prefix=CLIENT_SECRET_PREFIX)
        oauth2_client = OAuth2Client(
            client_id=generate_token(prefix=CLIENT_ID_PREFIX),
            user=None,
        )
        await oauth2_client.set_client_secret(client_secret)
        await oauth2_client.set_registration_access_token(
            generate_token(prefix=CLIENT_REGISTRATION_TOKEN_PREFIX)
        )
        oauth2_client.set_client_metadata(
            {
                "client_name": "Polar MCP Client",
                "redirect_uris": [],
                "token_endpoint_auth_method": "client_secret_post",
                "grant_types": ["web"],
                "response_types": [],
                "scope": " ".join(SCOPES_SUPPORTED),
            }
        )
        session.add(oauth2_client)
        await session.commit()

    print("[bold green]OAuth2 Client created successfully![/bold green]")

    print(f"Client ID: [bold]{oauth2_client.client_id}[/bold]")
    print(f"Client Secret: [bold]{client_secret}[/bold]")


if __name__ == "__main__":
    asyncio.run(create_client())
