import argparse
import asyncio
import os
import shlex
import tempfile
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

from dotenv import dotenv_values

from polar.kit.db.postgres import create_async_sessionmaker
from polar.oauth2.void_cli_client import ensure_client as ensure_void_cli_client
from polar.postgres import AsyncSession, create_async_engine
from polar.void.development.service import (
    ORGANIZATION_ID,
    ORGANIZATION_SLUG,
    PO_BOT,
    DevelopmentSeedConflict,
)
from polar.void.development.service import development as development_service
from scripts.generate_void_token import generate_void_token


def api_origin(value: str) -> str:
    parsed = urlparse(value)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {"", "/"}
        or parsed.params
        or parsed.query
        or parsed.fragment
    ):
        raise argparse.ArgumentTypeError("API URL must be an HTTP(S) server origin")
    return value.rstrip("/")


async def seed_token(session: AsyncSession) -> tuple[UUID, str, bool]:
    created = await development_service.seed_all(session)
    await ensure_void_cli_client(session)
    token = await generate_void_token(session, str(ORGANIZATION_ID), customers=True)
    return ORGANIZATION_ID, token, created


def write_environment(output: Path, token: str, api_url: str) -> None:
    existing = (
        {
            key: value
            for key, value in dotenv_values(output, interpolate=False).items()
            if value is not None
        }
        if output.exists()
        else {}
    )
    values = {
        **existing,
        "VOID_TOKEN": token,
        "VOID_API_URL": api_url,
    }
    content = "".join(
        f"export {key}={shlex.quote(value)}\n" for key, value in values.items()
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(
        prefix=f".{output.name}.", dir=output.parent
    )
    try:
        with os.fdopen(descriptor, "w") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)


async def run(output: Path, api_url: str) -> bool:
    engine = create_async_engine("script")
    try:
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as session, session.begin():
            _, token, created = await seed_token(session)
        write_environment(output, token, api_url)
        return created
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed a dedicated Void development organization and issue a 24-hour token"
    )
    parser.add_argument(
        "--output",
        required=True,
        type=Path,
        help="Write sourceable credentials to this file with mode 0600",
    )
    parser.add_argument(
        "--api-url",
        type=api_origin,
        default="http://127.0.0.1:8000",
        help="Polar API origin for the SDK and CLI",
    )
    arguments = parser.parse_args()
    output = arguments.output.expanduser().absolute()
    try:
        created = asyncio.run(run(output, arguments.api_url))
    except (ValueError, DevelopmentSeedConflict, OSError) as error:
        parser.error(str(error))
    print(
        f"{'Created' if created else 'Reused'} {ORGANIZATION_SLUG} and {PO_BOT.slug}. Credentials written to {output} (expires in 24 hours)."
    )


if __name__ == "__main__":
    main()
