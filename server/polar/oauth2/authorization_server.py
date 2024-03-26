import json
import typing

import structlog
from authlib.oauth2 import AuthorizationServer as _AuthorizationServer
from authlib.oauth2 import OAuth2Error
from authlib.oauth2.rfc6750 import BearerTokenGenerator
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.requests import Request
from starlette.responses import Response

from polar.config import settings
from polar.kit.crypto import generate_token, get_token_hash
from polar.logging import Logger
from polar.models import OAuth2Client, OAuth2Token, User
from polar.oauth2.constants import ACCESS_TOKEN_PREFIX, REFRESH_TOKEN_PREFIX

from .requests import StarletteJsonRequest, StarletteOAuth2Request

ExpiresInConfigType: typing.TypeAlias = dict[str, int]
TokenGeneratorType: typing.TypeAlias = typing.Callable[..., str]

logger: Logger = structlog.get_logger(__name__)


class AuthorizationServer(_AuthorizationServer):
    def __init__(
        self,
        session: Session,
        *,
        scopes_supported: list[str] | None = None,
        error_uris: list[tuple[str, str]] | None = None,
    ) -> None:
        super().__init__(scopes_supported)
        self.session = session
        self._error_uris = dict(error_uris) if error_uris is not None else None

        self.register_token_generator("default", self.create_bearer_token_generator())

    def query_client(self, client_id: str) -> OAuth2Client | None:
        statement = select(OAuth2Client).where(OAuth2Client.client_id == client_id)
        result = self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    def save_token(
        self, token: dict[str, typing.Any], request: StarletteOAuth2Request
    ) -> None:
        access_token = token.get("access_token", None)
        access_token_hash = (
            get_token_hash(access_token, secret=settings.SECRET)
            if access_token is not None
            else None
        )

        refresh_token = token.get("refresh_token", None)
        refresh_token_hash = (
            get_token_hash(refresh_token, secret=settings.SECRET)
            if refresh_token is not None
            else None
        )

        token_data = {
            **token,
            "access_token": access_token_hash,
            "refresh_token": refresh_token_hash,
        }
        oauth2_token = OAuth2Token(
            **token_data, client_id=request.client_id, user=request.user
        )
        self.session.add(oauth2_token)
        self.session.flush()

    def get_error_uri(self, request: Request, error: OAuth2Error) -> str | None:
        if self._error_uris is None or error.error is None:
            return None
        return self._error_uris.get(error.error)

    def create_oauth2_request(self, request: Request) -> StarletteOAuth2Request:
        return StarletteOAuth2Request(request)

    def create_json_request(self, request: Request) -> StarletteJsonRequest:
        return StarletteJsonRequest(request)

    def send_signal(
        self, name: str, *args: tuple[typing.Any], **kwargs: dict[str, typing.Any]
    ) -> None:
        logger.debug(f"Authlib signal: {name}", *args, **kwargs)

    def handle_response(
        self,
        status_code: int,
        payload: dict[str, typing.Any] | str,
        headers: list[tuple[str, str]],
    ) -> Response:
        if isinstance(payload, dict):
            payload = json.dumps(payload)
        return Response(payload, status_code, {k: v for k, v in headers})

    def create_bearer_token_generator(self) -> BearerTokenGenerator:
        def _access_token_generator(
            client: OAuth2Client, grant_type: str, user: User, scope: str
        ) -> str:
            return generate_token(prefix=ACCESS_TOKEN_PREFIX)

        def _refresh_token_generator(
            client: OAuth2Client, grant_type: str, user: User, scope: str
        ) -> str:
            return generate_token(prefix=REFRESH_TOKEN_PREFIX)

        return BearerTokenGenerator(_access_token_generator, _refresh_token_generator)
