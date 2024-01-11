from uuid import UUID

import httpx
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

        # _, magic_link_token = await magic_link_service.request(
        #     session,
        #     user.email,
        #     source="article_links",
        #     expires_at=utc_now() + timedelta(hours=24),
        # )

        email_headers: dict[str, str] = {}

        render_data = {
            # Add pre-authenticated tokens to the end of all links in the email
            # "inject_magic_link_token": magic_link_token,
        }

        # Get subscriber ID (if exists)
        subscriber = await article_service.get_subscriber(
            session, user_id, article.organization_id
        )
        if subscriber:
            unsubscribe_link = f"https://polar.sh/unsubscribe?org={article.organization.name}&id={subscriber.id}"
            render_data["unsubscribe_link"] = unsubscribe_link
            email_headers["List-Unsubscribe"] = f"<{unsubscribe_link}>"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.FRONTEND_BASE_URL}/email/article/{article.id}",
                json=render_data,
                # Authenticating to the renderer as the user we're sending the email to
                headers={"Cookie": f"polar_session={jwt};"},
                # Increase the default timeout because it can be slow to render
                timeout=60,
            )

        if not response.is_success:
            log.error(f"failed to get rendered article: code={response.status_code}")
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
            html_content=response.text,
            from_name=from_name,
            from_email_addr=f"{article.organization.name}@posts.polar.sh",
            email_headers=email_headers,
        )


@interval(second=0)
async def articles_send_scheduled(
    ctx: JobContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        articles = await article_service.list_scheduled_unsent_posts(session)
        for article in articles:
            await article_service.send_to_subscribers(session, article)
