"""Assign the `owner` role on an organization to a given user.

One-off maintenance script to repair organizations that ended up without an
active owner (e.g. their previous owner's user was soft-deleted). It mirrors
``user_organization.transfer_ownership`` — atomically demoting any current
owner to ``admin`` and promoting the target user — but **deliberately skips
the identity-verification gate**, so it can only be run out-of-band like this.

Usage:

    uv run python -m scripts.assign_organization_owner <org> <user>

    <org>   organization slug or id
    <user>  target user's email or id

The user must already be a member of the organization. A soft-deleted
membership is accepted, but only its `role` column is set to `owner` — the
membership stays soft-deleted (it is not revived). A non-member is rejected;
this script never creates a membership from scratch.

Defaults to a dry-run; pass --execute to actually write.

Options:
    --execute                actually assign the owner (default: dry-run)
    --sync-polar-for-polar   also sync the new owner's role on Polar's own
                             self-customer (mirrors organization.change_owner)
    --yes                    skip the confirmation prompt
"""

import asyncio
import uuid

import typer
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import UserOrganization
from polar.models.user_organization import OrganizationRole
from polar.organization.repository import OrganizationRepository
from polar.organization.service import CannotChangeOwnerError
from polar.organization.service import organization as organization_service
from polar.postgres import create_async_engine
from polar.user.repository import UserRepository
from polar.user_organization.repository import UserOrganizationRepository

cli = typer.Typer()


def _maybe_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


@cli.command()
def assign_owner(
    org: str = typer.Argument(..., help="Organization slug or id"),
    user: str = typer.Argument(..., help="Target user's email or id"),
    execute: bool = typer.Option(
        False, "--execute", help="Actually assign the owner (default: dry-run)."
    ),
    sync_polar_for_polar: bool = typer.Option(
        False,
        "--sync-polar-for-polar",
        help=(
            "Also sync the new owner's role on Polar's own self-customer, "
            "mirroring organization.change_owner. Fails if the org has no "
            "Polar self-customer/member."
        ),
    ),
    yes: bool = typer.Option(False, "--yes", help="Skip the confirmation prompt."),
) -> None:
    async def run() -> None:
        engine = create_async_engine("script")
        sessionmaker = create_async_sessionmaker(engine)
        async with sessionmaker() as session:
            org_repository = OrganizationRepository.from_session(session)
            user_repository = UserRepository.from_session(session)

            # Resolve organization (id or slug).
            org_id = _maybe_uuid(org)
            organization = (
                await org_repository.get_by_id(org_id)
                if org_id is not None
                else await org_repository.get_by_slug(org)
            )
            if organization is None:
                typer.echo(f"Organization '{org}' not found.")
                raise typer.Exit(code=1)

            # Resolve user (id or email).
            user_id = _maybe_uuid(user)
            target_user = (
                await user_repository.get_by_id(user_id)
                if user_id is not None
                else await user_repository.get_by_email(user)
            )
            if target_user is None:
                typer.echo(f"User '{user}' not found.")
                raise typer.Exit(code=1)

            uo_repository = UserOrganizationRepository.from_session(session)

            # Current owner (if any).
            current_owner = await org_repository.get_owner_user(organization)

            # Target user's membership, including a soft-deleted one. The
            # composite PK (user_id, organization_id) guarantees at most one
            # row, so no is_deleted filter is needed.
            membership = await session.scalar(
                select(UserOrganization).where(
                    UserOrganization.user_id == target_user.id,
                    UserOrganization.organization_id == organization.id,
                )
            )

            typer.echo(f"Organization : {organization.slug} ({organization.id})")
            typer.echo(
                "Current owner: "
                + (
                    f"{current_owner.email} ({current_owner.id})"
                    if current_owner is not None
                    else "<none>"
                )
            )
            typer.echo(f"New owner    : {target_user.email} ({target_user.id})")
            typer.echo(
                "Identity verification status (bypassed): "
                f"{target_user.identity_verification_status.get_display_name()}"
            )

            if membership is None:
                typer.echo(
                    f"User {target_user.email} is not a member of this "
                    "organization. Add them as a member first — this script "
                    "won't create a membership."
                )
                raise typer.Exit(code=1)

            member_is_deleted = membership.deleted_at is not None

            if membership.role == OrganizationRole.owner:
                typer.echo("User already holds the owner role. Nothing to do.")
                raise typer.Exit(code=0)

            plan = []
            if current_owner is not None:
                plan.append(f"demote current owner {current_owner.email} -> admin")
            suffix = " (still soft-deleted)" if member_is_deleted else ""
            plan.append(
                f"set role of {target_user.email} ({membership.role}) "
                f"-> owner{suffix}"
            )
            if sync_polar_for_polar:
                plan.append("sync new owner's role on Polar's self-customer")
            typer.echo("Plan: " + "; ".join(plan))

            if not execute:
                typer.echo("Dry run — no changes written. Pass --execute to apply.")
                raise typer.Exit(code=0)

            if not yes and not typer.confirm("Proceed?"):
                raise typer.Exit(code=1)

            # Demote any current owner first so the partial unique index
            # `ix_user_organizations_owner_per_org` never sees two owners.
            previous_owner_user_id = await uo_repository.demote_current_owner(
                organization.id
            )

            try:
                # Only set the role column; leave deleted_at untouched, so a
                # soft-deleted membership stays soft-deleted.
                await session.execute(
                    update(UserOrganization)
                    .where(
                        UserOrganization.user_id == target_user.id,
                        UserOrganization.organization_id == organization.id,
                    )
                    .values(role=OrganizationRole.owner)
                )
                await session.flush()
            except IntegrityError as e:
                typer.echo(f"Failed to assign owner: {e}")
                raise typer.Exit(code=1) from e

            if sync_polar_for_polar:
                # Reuse the same sync organization.change_owner performs, so the
                # owner's role on Polar's self-customer stays consistent.
                try:
                    await organization_service._sync_polar_self_customer_owner(
                        session,
                        organization_id=organization.id,
                        new_owner_user=target_user,
                    )
                except CannotChangeOwnerError as e:
                    typer.echo(f"Polar-for-Polar sync failed: {e}")
                    raise typer.Exit(code=1) from e

            await session.commit()
            typer.echo(
                f"Assigned {target_user.email} as owner of "
                f"{organization.slug} "
                f"(previous owner: {previous_owner_user_id})."
            )

    asyncio.run(run())


if __name__ == "__main__":
    cli()
