from polar.worker import TaskPriority, actor

from .react import render_from_json
from .sender import Attachment, email_sender


@actor(actor_name="email.send", priority=TaskPriority.HIGH)
async def email_send(
    to_email_addr: str,
    subject: str,
    html_content: str | None,
    from_name: str,
    from_email_addr: str,
    email_headers: dict[str, str] | None,
    reply_to_name: str | None,
    reply_to_email_addr: str | None,
    template: str | None = None,
    props_json: str | None = None,
    attachments: list[Attachment] | None = None,
) -> None:
    if html_content is None:
        assert template is not None
        assert props_json is not None
        html_content = render_from_json(template, props_json)

    await email_sender.send(
        to_email_addr=to_email_addr,
        subject=subject,
        html_content=html_content,
        from_name=from_name,
        from_email_addr=from_email_addr,
        email_headers=email_headers,
        reply_to_name=reply_to_name,
        reply_to_email_addr=reply_to_email_addr,
        attachments=attachments,
    )
