"""Create or update the public PKCE OAuth client used by `void login`."""

import argparse
import asyncio
from typing import Literal

from rich import print

from polar.kit.crypto import generate_token
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import OAuth2Client
from polar.postgres import AsyncSession, create_async_engine

from .constants import CLIENT_REGISTRATION_TOKEN_PREFIX, CLIENT_SECRET_PREFIX
from .service.oauth2_client import oauth2_client as oauth2_client_service

Environment = Literal["production", "sandbox", "local"]

CLIENT_IDS: dict[Environment, str] = {
    "production": "polar_ci_XjXQSSOPTGUtMFJccc9vYhb6kYiw7YZ2XdYPX3FVG1z",
    "sandbox": "polar_ci_5ITcpZLBKyOabQJNLHyIZREcPqTdCa5iDvQVD2AiHU1",
    "local": "polar_ci_7zZLPbfy8HPbtjZ9IEhU2XQIsl8ntM3nI1XKt4Ja7h1",
}

REDIRECT_URI = "http://127.0.0.1:3334/oauth/callback"
SCOPES = (
    "openid profile organizations:read void:read void:write "
    "customers:read customers:write"
)


def client_metadata() -> dict[str, object]:
    return {
        "client_name": "Void CLI",
        "redirect_uris": [REDIRECT_URI],
        "token_endpoint_auth_method": "none",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "scope": SCOPES,
        "default_sub_type": "organization",
    }


async def ensure_client(
    session: AsyncSession, environment: Environment = "local"
) -> tuple[OAuth2Client, bool]:
    client_id = CLIENT_IDS[environment]
    existing = await oauth2_client_service.get_by_client_id(session, client_id)
    if existing is not None:
        existing.first_party = False
        existing.set_client_metadata(client_metadata())
        await session.flush()
        return existing, False

    client = OAuth2Client(client_id=client_id, user=None, first_party=False)
    await client.set_client_secret(generate_token(prefix=CLIENT_SECRET_PREFIX))
    await client.set_registration_access_token(
        generate_token(prefix=CLIENT_REGISTRATION_TOKEN_PREFIX)
    )
    client.set_client_metadata(client_metadata())
    session.add(client)
    await session.flush()
    return client, True


async def create_client(environment: Environment) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        client, created = await ensure_client(session, environment)
        await session.commit()

    action = "Created" if created else "Updated"
    print(f"[bold green]{action} Void CLI OAuth client ({environment}).[/bold green]")
    print(f"Client ID: [bold]{client.client_id}[/bold]")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Create or update the Void CLI OAuth client"
    )
    parser.add_argument(
        "--environment",
        choices=tuple(CLIENT_IDS),
        default="local",
        help="Which baked-in client ID to create",
    )
    args = parser.parse_args()
    asyncio.run(create_client(args.environment))
