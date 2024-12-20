from arq import Retry

from polar.worker import JobContext, PolarWorkerContext, compute_backoff, task

from .sender import SendEmailError, get_email_sender


@task("email.send", max_tries=10)
async def email_send(
    ctx: JobContext,
    to_email_addr: str,
    subject: str,
    html_content: str,
    from_name: str,
    from_email_addr: str,
    email_headers: dict[str, str],
    reply_to_name: str | None,
    reply_to_email_addr: str | None,
    polar_context: PolarWorkerContext,
) -> None:
    email_sender = get_email_sender()

    try:
        await email_sender.send(
            to_email_addr=to_email_addr,
            subject=subject,
            html_content=html_content,
            from_name=from_name,
            from_email_addr=from_email_addr,
            email_headers=email_headers,
            reply_to_name=reply_to_name,
            reply_to_email_addr=reply_to_email_addr,
        )
    except SendEmailError as e:
        raise Retry(compute_backoff(ctx["job_try"])) from e
