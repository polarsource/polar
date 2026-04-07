from fastapi import Request
from starlette.types import ASGIApp, Message, Receive, Send
from starlette.types import Scope as ASGIScope

from polar.auth.models import (
    AuthSubject,
    Subject,
    is_anonymous,
    is_organization,
    is_user,
)
from polar.logging import CorrelationID

from .tasks import AuditLog


class AuditLogMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: ASGIScope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # our middleware expects to have these to understand
        # the user/org context. So we must have this middleware declared
        # after "AuthSubjectMiddleware"
        auth_subject: AuthSubject[Subject] = scope["state"]["auth_subject"]

        # we don't track anonymous calls because we want to bind the calls
        # to an org/account
        if is_anonymous(auth_subject):
            await self.app(scope, receive, send)
            return

        audit_logger = AuditLog()

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                error = None
                try:
                    await send(message)
                except Exception as x:
                    error = str(x)
                    raise
                finally:
                    request = Request(scope)
                    status_code = message["status"]

                    user_id = org_id = None

                    if is_user(auth_subject):
                        user_id = auth_subject.subject.id
                    elif is_organization(auth_subject):
                        org_id = auth_subject.subject.id

                    correlation_id = CorrelationID.get()

                    # unpacking request here to not pollute tasks.py with
                    # HTTP related frameworks
                    await audit_logger.record(
                        user_id=user_id,
                        org_id=org_id,
                        method=request.method,
                        path=request.url.path,
                        status=status_code,
                        error=error,
                        correlation_id=correlation_id,
                    )

        await self.app(scope, receive, send_wrapper)
