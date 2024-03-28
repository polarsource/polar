import json
import time
import typing

import structlog
from authlib.oauth2 import AuthorizationServer as _AuthorizationServer
from authlib.oauth2 import OAuth2Error
from authlib.oauth2.rfc6750 import BearerTokenGenerator
from authlib.oauth2.rfc7009 import RevocationEndpoint as _RevocationEndpoint
from authlib.oauth2.rfc7591 import (
    ClientRegistrationEndpoint as _ClientRegistrationEndpoint,
)
from authlib.oauth2.rfc7592 import (
    ClientConfigurationEndpoint as _ClientConfigurationEndpoint,
)
from authlib.oauth2.rfc7662 import IntrospectionEndpoint as _IntrospectionEndpoint
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from starlette.requests import Request
from starlette.responses import Response

from polar.config import settings
from polar.kit.crypto import generate_token, get_token_hash
from polar.logging import Logger
from polar.models import OAuth2Client, OAuth2Token, User

from .constants import (
    ACCESS_TOKEN_PREFIX,
    CLIENT_ID_PREFIX,
    CLIENT_SECRET_PREFIX,
    REFRESH_TOKEN_PREFIX,
)
from .grants import CodeChallenge, register_grants
from .metadata import get_server_metadata
from .requests import StarletteJsonRequest, StarletteOAuth2Request
from .service.oauth2_grant import oauth2_grant as oauth2_grant_service

ExpiresInConfigType: typing.TypeAlias = dict[str, int]
TokenGeneratorType: typing.TypeAlias = typing.Callable[..., str]

logger: Logger = structlog.get_logger(__name__)


def _get_server_metadata(server: "AuthorizationServer") -> dict[str, typing.Any]:
    def _dummy_url_for(name: str) -> str:
        return name

    return get_server_metadata(server, _dummy_url_for).model_dump(exclude_unset=True)


class ClientRegistrationEndpoint(_ClientRegistrationEndpoint):
    server: "AuthorizationServer"

    def generate_client_registration_info(
        self, client: OAuth2Client, request: StarletteJsonRequest
    ) -> dict[str, str]:
        return {
            "registration_client_uri": str(
                request._request.url_for("oauth2.configure", client_id=client.client_id)
            ),
            "registration_access_token": generate_token(
                prefix="registration_access_token"
            ),
        }

    def generate_client_id(self) -> str:
        return generate_token(prefix=CLIENT_ID_PREFIX, nbytes=16)

    def generate_client_secret(self) -> str:
        return generate_token(prefix=CLIENT_SECRET_PREFIX)

    def get_server_metadata(self) -> dict[str, typing.Any]:
        return _get_server_metadata(self.server)

    def authenticate_token(self, request: StarletteJsonRequest) -> User | None:
        return request.user

    def save_client(
        self,
        client_info: dict[str, typing.Any],
        client_metadata: dict[str, typing.Any],
        request: StarletteJsonRequest,
    ) -> OAuth2Client:
        oauth2_client = OAuth2Client(**client_info)
        oauth2_client.set_client_metadata(client_metadata)
        self.server.session.add(oauth2_client)
        self.server.session.flush()
        return oauth2_client


class ClientConfigurationEndpoint(_ClientConfigurationEndpoint):
    server: "AuthorizationServer"

    def generate_client_registration_info(
        self, client: OAuth2Client, request: StarletteJsonRequest
    ) -> dict[str, str]:
        return {
            "registration_client_uri": str(
                request._request.url_for("oauth2.configure", client_id=client.client_id)
            ),
            "registration_access_token": generate_token(
                prefix="registration_access_token"
            ),
        }

    def authenticate_token(self, request: StarletteJsonRequest) -> bool:
        return True

    def authenticate_client(self, request: StarletteJsonRequest) -> OAuth2Client | None:
        client_id = request.path_params.get("client_id")
        if client_id is None:
            return None

        statement = select(OAuth2Client).where(OAuth2Client.client_id == client_id)
        result = self.server.session.execute(statement)
        return result.unique().scalar_one_or_none()

    def revoke_access_token(
        self, token: typing.Any, request: StarletteJsonRequest
    ) -> None:
        return None

    def check_permission(
        self, client: OAuth2Client, request: StarletteJsonRequest
    ) -> bool:
        return True

    def delete_client(
        self, client: OAuth2Client, request: StarletteJsonRequest
    ) -> None:
        self.server.session.delete(client)
        self.server.session.flush()

    def update_client(
        self,
        client: OAuth2Client,
        client_metadata: dict[str, typing.Any],
        request: StarletteJsonRequest,
    ) -> OAuth2Client:
        client.set_client_metadata({**client.client_metadata, **client_metadata})
        self.server.session.add(client)
        self.server.session.flush()
        return client

    def get_server_metadata(self) -> dict[str, typing.Any]:
        return _get_server_metadata(self.server)


class _QueryTokenMixin:
    server: "AuthorizationServer"

    def query_token(
        self,
        token: str,
        token_type_hint: typing.Literal["access_token", "refresh_token"] | None,
    ) -> OAuth2Token | None:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        statement = select(OAuth2Token)
        if token_type_hint == "access_token":
            statement = statement.where(OAuth2Token.access_token == token_hash)
        elif token_type_hint == "refresh_token":
            statement = statement.where(OAuth2Token.refresh_token == token_hash)
        else:
            statement = statement.where(
                or_(
                    OAuth2Token.access_token == token_hash,
                    OAuth2Token.refresh_token == token_hash,
                )
            )

        result = self.server.session.execute(statement)
        return result.unique().scalar_one_or_none()


class RevocationEndpoint(_QueryTokenMixin, _RevocationEndpoint):
    CLIENT_AUTH_METHODS = ["client_secret_basic", "client_secret_post"]

    def revoke_token(self, token: OAuth2Token, request: StarletteOAuth2Request) -> None:
        now = int(time.time())
        hint: typing.Literal["access_token", "refresh_token"] | None = request.form.get(
            "token_type_hint"
        )
        token.access_token_revoked_at = now  # pyright: ignore
        if hint != "access_token":
            token.refresh_token_revoked_at = now  # pyright: ignore
        self.server.session.add(token)
        self.server.session.flush()


class IntrospectionEndpoint(_QueryTokenMixin, _IntrospectionEndpoint):
    CLIENT_AUTH_METHODS = ["client_secret_basic", "client_secret_post"]

    def check_permission(
        self, token: OAuth2Token, client: OAuth2Client, request: StarletteOAuth2Request
    ) -> bool:
        return token.check_client(client)

    def introspect_token(self, token: OAuth2Token) -> dict[str, typing.Any]:
        return {
            "active": True,
            "client_id": token.client_id,
            "token_type": token.token_type,
            "username": token.user.username,
            "scope": token.get_scope(),
            "sub": str(token.user_id),
            "aud": token.client_id,
            "iss": "https://server.example.com/",
            "exp": token.get_expires_at(),
            "iat": token.issued_at,
        }


class AuthorizationServer(_AuthorizationServer):
    if typing.TYPE_CHECKING:

        def create_endpoint_response(
            self, name: str, request: Request | None = None
        ) -> Response:
            ...

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

    @classmethod
    def build(
        cls,
        session: Session,
        *,
        scopes_supported: list[str] | None = None,
        error_uris: list[tuple[str, str]] | None = None,
    ) -> typing.Self:
        authorization_server = cls(
            session, scopes_supported=scopes_supported, error_uris=error_uris
        )
        authorization_server.register_endpoint(RevocationEndpoint)
        authorization_server.register_endpoint(IntrospectionEndpoint)
        authorization_server.register_endpoint(ClientRegistrationEndpoint)
        authorization_server.register_endpoint(ClientConfigurationEndpoint)
        register_grants(authorization_server)
        return authorization_server

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

    def create_authorization_response(
        self,
        request: Request,
        grant_user: User | None = None,
        save_consent: bool = False,
    ) -> typing.Any:
        response: Response = super().create_authorization_response(request, grant_user)

        if save_consent and response.status_code < 400:
            assert grant_user is not None
            self._save_consent(request, grant_user)

        return response

    def _save_consent(self, request: Request, grant_user: User) -> None:
        oauth2_request = self.create_oauth2_request(request)
        oauth2_grant_service.create_or_update_grant(
            self.session,
            user_id=grant_user.id,
            client_id=oauth2_request.client_id,
            scope=oauth2_request.scope,
        )

    @property
    def response_types_supported(self) -> list[str]:
        response_types: list[str] = []
        for grant, _ in self._authorization_grants:
            try:
                response_types.extend(getattr(grant, "RESPONSE_TYPES"))
            except AttributeError:
                pass
        return response_types

    @property
    def response_modes_supported(self) -> list[str]:
        return ["query"]

    @property
    def grant_types_supported(self) -> list[str]:
        grant_types: set[str] = set()
        for grant, _ in [*self._authorization_grants, *self._token_grants]:
            try:
                grant_types.add(getattr(grant, "GRANT_TYPE"))
            except AttributeError:
                pass
        return list(grant_types)

    @property
    def token_endpoint_auth_methods_supported(self) -> list[str]:
        return ["client_secret_basic", "client_secret_post", "none"]

    @property
    def revocation_endpoint_auth_methods_supported(self) -> list[str]:
        auth_methods: set[str] = set()
        for endpoint in self._endpoints.get(RevocationEndpoint.ENDPOINT_NAME, []):
            auth_methods.union(getattr(endpoint, "CLIENT_AUTH_METHODS", []))
        return list(auth_methods)

    @property
    def introspection_endpoint_auth_methods_supported(self) -> list[str]:
        auth_methods: set[str] = set()
        for endpoint in self._endpoints.get(IntrospectionEndpoint.ENDPOINT_NAME, []):
            auth_methods.union(getattr(endpoint, "CLIENT_AUTH_METHODS", []))
        return list(auth_methods)

    @property
    def code_challenge_methods_supported(self) -> list[str]:
        code_challenge_methods: set[str] = set()
        for _, extensions in self._authorization_grants:
            for extension in extensions:
                if isinstance(extension, CodeChallenge):
                    code_challenge_methods.union(
                        extension.SUPPORTED_CODE_CHALLENGE_METHOD
                    )
        return list(code_challenge_methods)
