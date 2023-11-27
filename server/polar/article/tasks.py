from uuid import UUID

from polar.email.sender import get_email_sender
from polar.user.service import user as user_service
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from .service import article_service

sender = get_email_sender()


@task("articles.send_to_user")
async def articles_send_to_user(
    ctx: JobContext,
    article_id: UUID,
    user_id: UUID,
    is_test: bool,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        user = await user_service.get(session, user_id)
        if not user:
            # err?
            return

        article = await article_service.get_loaded(session, article_id)
        if not article:
            return

        subject = "[TEST] " if is_test else ""
        subject += article.title

        sender.send_to_user(
            to_email_addr=user.email,
            subject=subject,
            html_content=article.body,
        )
