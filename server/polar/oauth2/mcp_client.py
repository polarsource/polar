"""Script to generate an OAuth2 client for our MCP server."""

import argparse
import asyncio
from pathlib import Path

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


async def create_client(add_to_env_file: bool) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        oauth2_client = OAuth2Client(
            client_id=generate_token(prefix=CLIENT_ID_PREFIX),
            client_secret=generate_token(prefix=CLIENT_SECRET_PREFIX),
            registration_access_token=generate_token(
                prefix=CLIENT_REGISTRATION_TOKEN_PREFIX
            ),
            user=None,
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

    if add_to_env_file:
        env_file_path = (
            Path(__file__).parent.parent.parent.parent
            / "clients"
            / "apps"
            / "web"
            / ".env.local"
        )
        with open(env_file_path, "a") as f:
            f.write(f"\nMCP_OAUTH2_CLIENT_ID={oauth2_client.client_id}\n")
            f.write(f"MCP_OAUTH2_CLIENT_SECRET={oauth2_client.client_secret}\n")
        print(f"[bold blue]Credentials added to {env_file_path}[/bold blue]")
    else:
        print(f"Client ID: [bold]{oauth2_client.client_id}[/bold]")
        print(f"Client Secret: [bold]{oauth2_client.client_secret}[/bold]")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate an OAuth2 client for MCP server"
    )
    parser.add_argument(
        "--add-to-env-file",
        action="store_true",
        help="Add credentials to .env.local file instead of printing them",
    )

    args = parser.parse_args()
    asyncio.run(create_client(args.add_to_env_file))
