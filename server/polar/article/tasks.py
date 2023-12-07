import urllib.request
from uuid import UUID

import structlog

from polar.auth.service import AuthService
from polar.config import settings
from polar.email.sender import get_email_sender
from polar.logging import Logger
from polar.models.article import Article
from polar.user.service import user as user_service
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    interval,
    task,
)

from .service import article_service

log: Logger = structlog.get_logger()


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

        (jwt, _) = AuthService.generate_token(user)

        # Authenticating to the renderer as the user we're sending the email to
        req = urllib.request.Request(
            f"{settings.FRONTEND_BASE_URL}/email/article/{article.id}",
        )
        req.add_header("Cookie", f"polar_session={jwt};")

        try:
            res = urllib.request.urlopen(req)
            rendered = res.read()
        except Exception as error:
            log.error(f"failed to get rendered article: {error}")
            return None

        from_name = ""
        if article.byline == Article.Byline.organization:
            from_name = article.organization.pretty_name or article.organization.name
        else:
            from_name = article.created_by_user.username

        email_sender = get_email_sender("article")

        email_sender.send_to_user(
            to_email_addr=user.email,
            subject=subject,
            html_content=rendered.decode("utf8"),
            from_name=from_name,
            from_email_addr=f"{article.organization.name}@posts.polar.sh",
        )


@interval(second=0)
async def articles_send_scheduled(
    ctx: JobContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        articles = await article_service.list_scheduled_unsent_posts(session)
        for article in articles:
            await article_service.send_to_subscribers(session, article)
