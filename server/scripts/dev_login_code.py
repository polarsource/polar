"""Issue a login code for the newest pending email sign-in. Local development only.

The API only keeps a hash of each code, so the code it logged can't be read back.
This replaces that hash with a new code's and prints the new code.

It talks to the table directly rather than through the models and the auth module,
because importing those takes about two seconds and this runs while someone waits.
"""

import asyncio
from typing import Any

import typer
from reauth.crypto import generate_code_hash_pair
from sqlalchemy import Row, text

from polar.config import settings
from polar.kit.crypto import get_legacy_secret
from polar.kit.db.postgres import create_async_sessionmaker  # lint-skip: dry-run
from polar.kit.utils import utc_now
from polar.postgres import AsyncSession, create_async_engine
from scripts.db import assert_dev_or_testing

cli = typer.Typer()

REPLACE_NEWEST_PENDING_CODE = text(
    """
    UPDATE email_otps
    SET code_hash = :code_hash
    WHERE id = (
        SELECT id
        FROM email_otps
        WHERE expires_at > :now
          AND (CAST(:email AS VARCHAR) IS NULL OR email = :email)
        ORDER BY created_at DESC
        LIMIT 1
    )
    RETURNING id, email, created_at, expires_at
    """
)


async def issue_login_code(
    session: AsyncSession, email: str | None = None
) -> tuple[Row[Any], str] | None:
    code, code_hash = generate_code_hash_pair(
        secret=get_legacy_secret(), length=settings.EMAIL_OTP_CODE_LENGTH
    )
    result = await session.execute(
        REPLACE_NEWEST_PENDING_CODE,
        {"code_hash": code_hash, "now": int(utc_now().timestamp()), "email": email},
    )
    email_otp = result.one_or_none()
    if email_otp is None:
        return None
    return email_otp, code


@cli.command()
def main(
    email: str | None = typer.Option(
        None, "--email", help="Only consider sign-ins for this email address"
    ),
) -> None:
    assert_dev_or_testing()

    async def run() -> tuple[Row[Any], str] | None:
        engine = create_async_engine("script")
        async with create_async_sessionmaker(engine)() as session:
            issued = await issue_login_code(session, email)
            await session.commit()
        await engine.dispose()
        return issued

    issued = asyncio.run(run())
    if issued is None:
        return
    email_otp, code = issued
    typer.echo(f"EMAIL={email_otp.email}")
    typer.echo(f"CODE={code}")
    typer.echo(f"CREATED_AT={int(email_otp.created_at.timestamp())}")
    typer.echo(f"EXPIRES_AT={email_otp.expires_at}")


if __name__ == "__main__":
    cli()
