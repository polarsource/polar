"""Reset (disable) a user's MFA to unblock them at login.

Out-of-band engineer tool for the case where a user has lost their authenticator
app or backup codes and can't complete MFA to sign in. It mirrors the product's
own disable-MFA path (``DELETE /totp``): it deletes the user's TOTP enrollment and
their backup codes. Email OTP is left untouched — that's the login factor the user
falls back to, so they can sign in again and re-enroll TOTP if they want.

Usage:

    uv run python -m scripts.reset_user_mfa <user>

    <user>  target user's email or id
"""

import asyncio
import uuid

import typer

from polar.auth.factors import BackupCodesFactor, TOTPFactor
from polar.kit.db.postgres import create_async_sessionmaker
from polar.postgres import create_async_engine
from polar.user.repository import UserRepository

cli = typer.Typer()


def _maybe_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


@cli.command()
def reset_mfa(
    user: str = typer.Argument(..., help="Target user's email or id"),
) -> None:
    async def run() -> None:
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as session:
            user_repository = UserRepository.from_session(session)

            user_id = _maybe_uuid(user)
            target_user = (
                await user_repository.get_by_id(user_id)
                if user_id is not None
                else await user_repository.get_by_email(user)
            )
            if target_user is None:
                typer.echo(f"User '{user}' not found.")
                raise typer.Exit(code=1)

            totp_factor = TOTPFactor(session)
            backup_codes_factor = BackupCodesFactor(session)

            totp_enrollment = await totp_factor.get_by_identity_id(target_user.id)
            backup_codes_enrollment = await backup_codes_factor.get_enrollment(
                target_user.id
            )

            typer.echo(f"User        : {target_user.email} ({target_user.id})")
            typer.echo(
                "TOTP        : "
                + (
                    f"enrolled ({'enabled' if totp_enrollment.enabled else 'disabled'})"
                    if totp_enrollment is not None
                    else "<none>"
                )
            )
            typer.echo(
                "Backup codes: "
                + ("enrolled" if backup_codes_enrollment is not None else "<none>")
            )

            if totp_enrollment is None and backup_codes_enrollment is None:
                typer.echo("No MFA enrolled — nothing to reset.")
                raise typer.Exit(code=0)

            plan = []
            if totp_enrollment is not None:
                plan.append("delete TOTP enrollment")
            if backup_codes_enrollment is not None:
                plan.append("delete backup codes")
            typer.echo("Plan: " + "; ".join(plan))

            if not typer.confirm("Proceed?"):
                raise typer.Exit(code=1)

            if totp_enrollment is not None:
                await totp_factor.delete(totp_enrollment)
            if backup_codes_enrollment is not None:
                await backup_codes_factor.delete(backup_codes_enrollment)

            await session.commit()
            typer.echo(
                f"Reset MFA for {target_user.email}. "
                "They can sign in with an email code and re-enroll TOTP."
            )

    asyncio.run(run())


if __name__ == "__main__":
    cli()
