from collections import defaultdict
from uuid import UUID

import typer
from sqlalchemy import select, update

from polar.backoffice_user.repository import BackofficeUserRepository
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import (
    OrganizationReviewFeedback,
    SupportCase,
    SupportCaseMessage,
    SupportCaseParticipant,
    User,
)
from polar.models.support_case import SupportCaseMessageAuthorKind
from polar.postgres import create_async_engine
from scripts.helper import configure_script_logging, typer_async

cli = typer.Typer()
configure_script_logging()


async def backfill_batch(session: AsyncSession, batch_size: int) -> int:
    repository = BackofficeUserRepository.from_session(session)
    for legacy, backoffice, criteria in (
        (
            OrganizationReviewFeedback.reviewer_id,
            OrganizationReviewFeedback.backoffice_reviewer_id,
            (),
        ),
        (SupportCase.assigned_user_id, SupportCase.backoffice_assigned_user_id, ()),
        (
            SupportCaseParticipant.platform_user_id,
            SupportCaseParticipant.backoffice_platform_user_id,
            (),
        ),
        (
            SupportCaseMessage.author_user_id,
            SupportCaseMessage.backoffice_author_user_id,
            (SupportCaseMessage.author_kind == SupportCaseMessageAuthorKind.platform,),
        ),
    ):
        table = legacy.property.columns[0].table
        pending = backoffice.is_(None)
        rows = await session.execute(
            select(table.c.id, legacy, User.email)
            .select_from(table)
            .join(User, legacy == User.id)
            .where(pending, *criteria)
            .order_by(table.c.id)
            .limit(batch_size)
        )
        by_user: dict[tuple[str, UUID], list[UUID]] = defaultdict(list)
        for row_id, user_id, email in rows:
            by_user[email.strip().lower(), user_id].append(row_id)
        if not by_user:
            continue
        for (email, user_id), ids in sorted(by_user.items()):
            backoffice_user = await repository.get_or_create_by_email(email)
            await session.execute(
                update(table)
                .where(table.c.id.in_(ids), legacy == user_id, pending, *criteria)
                .values({backoffice.key: backoffice_user.id})
            )
        return sum(map(len, by_user.values()))
    return 0


@cli.command()
@typer_async
async def backfill_backoffice_attribution(
    batch_size: int = typer.Option(1000, min=1),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        total = 0
        while True:
            async with sessionmaker.begin() as session:
                processed = await backfill_batch(session, batch_size)
            if not processed:
                typer.echo(f"Processed {total} staff references")
                return
            total += processed
    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
