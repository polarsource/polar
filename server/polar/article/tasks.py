from uuid import UUID

import mistune

from polar.config import settings
from polar.email.renderer import get_email_renderer
from polar.email.sender import get_email_sender
from polar.user.service import user as user_service
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from .service import article_service


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

        article_html = mistune.html(article.body)

        email_renderer = get_email_renderer({"article": "polar.article"})
        email_sender = get_email_sender()

        subject, body = email_renderer.render_from_template(
            subject,
            "article/article.html",
            {
                "article_body": article_html,
                "url": f"{settings.FRONTEND_BASE_URL}/{article.organization.name}/posts/{article.slug}",
            },
        )

        email_sender.send_to_user(
            to_email_addr=user.email,
            subject=subject,
            html_content=body,
        )
