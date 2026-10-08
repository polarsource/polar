import structlog
from fastapi import WebSocket

from polar.auth.models import AuthSubject, Organization, Subject, is_organization
from polar.auth.scope import Scope
from polar.exception_handlers import polar_exception_handler
from polar.exceptions import Unauthorized
from polar.logging import Logger
from polar.oauth2.exceptions import InsufficientScopeError

REQUIRED_SCOPES = {Scope.events_write}

log: Logger = structlog.get_logger(__name__)


async def authenticate(websocket: WebSocket) -> AuthSubject[Organization] | None:
    auth_subject: AuthSubject[Subject] = websocket.state.auth_subject
    if not is_organization(auth_subject):
        log.debug("Invalid auth subject", subject_type=type(auth_subject.subject))
        await websocket.send_denial_response(
            await polar_exception_handler(websocket, Unauthorized())
        )
        return None
    if not auth_subject.scopes & REQUIRED_SCOPES:
        log.debug("Insufficient scopes", scopes=auth_subject.scopes)
        await websocket.send_denial_response(
            await polar_exception_handler(
                websocket,
                InsufficientScopeError({str(s) for s in REQUIRED_SCOPES}),
            )
        )
        return None
    await websocket.accept()
    log.debug("WebSocket connection accepted", subject_id=auth_subject.subject.id)
    return auth_subject
