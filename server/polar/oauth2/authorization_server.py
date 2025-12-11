import json
import secrets
import time
import typing

import structlog
from authlib.oauth2 import AuthorizationServer as _AuthorizationServer
from authlib.oauth2 import OAuth2Error
from authlib.oauth2.rfc6749.errors import (
    UnsupportedResponseTypeError,
)
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

from polar.auth.scope import Scope
from polar.config import settings
from polar.kit.crypto import generate_token, get_token_hash
from polar.logging import Logger
from polar.models import OAuth2Client, OAuth2Token, User
from polar.oauth2.sub_type import SubTypeValue

from .constants import (
    ACCESS_TOKEN_PREFIX,
    CLIENT_ID_PREFIX,
    CLIENT_REGISTRATION_TOKEN_PREFIX,
    CLIENT_SECRET_PREFIX,
    ISSUER,
    REFRESH_TOKEN_PREFIX,
)
from .grants import AuthorizationCodeGrant, CodeChallenge, register_grants
from .metadata import get_server_metadata
from .requests import StarletteJsonRequest, StarletteOAuth2Request
from .service.oauth2_grant import oauth2_grant as oauth2_grant_service

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
        assert client.registration_access_token is not None
        return {
            "registration_client_uri": str(
                request.url_for("oauth2:get_client", client_id=client.client_id)
            ),
            "registration_access_token": client.registration_access_token,
        }

    def generate_client_id(self, request: StarletteJsonRequest) -> str:
        return generate_token(prefix=CLIENT_ID_PREFIX)

    def generate_client_secret(self, request: StarletteJsonRequest) -> str:
        return generate_token(prefix=CLIENT_SECRET_PREFIX)

    def create_registration_response(
        self, request: StarletteJsonRequest
    ) -> tuple[int, dict[str, typing.Any], list[tuple[str, str]]]:
        """
        Create client registration response.

        Temporary workaround: Exclude client_secret and client_secret_expires_at
        from the response when token_endpoint_auth_method is 'none', as this
        helps clients that haven't yet updated to properly handle public clients.
        """
        status, body, headers = super().create_registration_response(request)

        # Check if this is a public client (token_endpoint_auth_method = none)
        if isinstance(body, dict):
            token_endpoint_auth_method = body.get("token_endpoint_auth_method")
            if token_endpoint_auth_method == "none":
                # Remove client_secret fields for public clients as a temporary workaround
                body.pop("client_secret", None)
                body.pop("client_secret_expires_at", None)

        return status, body, headers

    def get_server_metadata(self) -> dict[str, typing.Any]:
        return _get_server_metadata(self.server)

    def authenticate_token(self, request: StarletteJsonRequest) -> User | str:
        return request.user if request.user is not None else "dynamic_client"

    def save_client(
        self,
        client_info: dict[str, typing.Any],
        client_metadata: dict[str, typing.Any],
        request: StarletteJsonRequest,
    ) -> OAuth2Client:
        oauth2_client = OAuth2Client(**client_info)
        oauth2_client.set_client_metadata(client_metadata)

        if request.user is not None:
            oauth2_client.user_id = request.user.id
        oauth2_client.registration_access_token = generate_token(
            prefix=CLIENT_REGISTRATION_TOKEN_PREFIX
        )

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
                request.url_for("oauth2:get_client", client_id=client.client_id)
            ),
            "registration_access_token": client.registration_access_token,
        }

    def create_read_client_response(
        self, client: OAuth2Client, request: StarletteJsonRequest
    ) -> tuple[int, dict[str, typing.Any], list[tuple[str, str]]]:
        """
        Create client read response (GET endpoint).

        Temporary workaround: Exclude client_secret and client_secret_expires_at
        from the response when token_endpoint_auth_method is 'none', as this
        helps clients that haven't yet updated to properly handle public clients.
        """
        status, body, headers = super().create_read_client_response(client, request)

        # Check if this is a public client (token_endpoint_auth_method = none)
        if isinstance(body, dict):
            token_endpoint_auth_method = body.get("token_endpoint_auth_method")
            if token_endpoint_auth_method == "none":
                # Remove client_secret fields for public clients as a temporary workaround
                body.pop("client_secret", None)
                body.pop("client_secret_expires_at", None)

        return status, body, headers

    def authenticate_token(self, request: StarletteJsonRequest) -> User | str | None:
        if request.user is not None:
            return request.user

        authorization = request.headers.get("Authorization")
        if authorization is None:
            return None

        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token != "":
            return token

        return None

    def authenticate_client(self, request: StarletteJsonRequest) -> OAuth2Client | None:
        client_id = request.path_params.get("client_id")
        if client_id is None:
            return None

        statement = select(OAuth2Client).where(
            OAuth2Client.deleted_at.is_(None), OAuth2Client.client_id == client_id
        )
        result = self.server.session.execute(statement)
        client = result.unique().scalar_one_or_none()

        if client is None:
            return None

        credential = request.credential
        if (
            credential is None
            or (
                isinstance(credential, str)
                and not secrets.compare_digest(
                    client.registration_access_token, credential
                )
            )
            or (isinstance(credential, User) and client.user_id != credential.id)
        ):
            return None

        return client

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
        client.set_deleted_at()
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
        token_string: str,
        token_type_hint: typing.Literal["access_token", "refresh_token"] | None,
    ) -> OAuth2Token | None:
        token_hash = get_token_hash(token_string, secret=settings.SECRET)
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
        hint = request.form.get("token_type_hint")
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
        return token.check_client(client)  # pyright: ignore

    def introspect_token(self, token: OAuth2Token) -> dict[str, typing.Any]:
        return token.get_introspection_data(ISSUER)


class AuthorizationServer(_AuthorizationServer):
    if typing.TYPE_CHECKING:

        def create_endpoint_response(
            self, name: str, request: Request | None = None
        ) -> Response: ...

    def __init__(
        self,
        session: Session,
        *,
        error_uris: list[tuple[str, str]] | None = None,
    ) -> None:
        super().__init__(
            # Allow also reserved scopes for first-party clients
            scopes_supported=[s.value for s in Scope],
        )
        self.session = session
        self._error_uris = dict(error_uris) if error_uris is not None else None

        self.register_token_generator("default", self.create_bearer_token_generator())

    @classmethod
    def build(
        cls,
        session: Session,
        *,
        error_uris: list[tuple[str, str]] | None = None,
    ) -> typing.Self:
        authorization_server = cls(session, error_uris=error_uris)
        authorization_server.register_endpoint(RevocationEndpoint)
        authorization_server.register_endpoint(IntrospectionEndpoint)
        authorization_server.register_endpoint(ClientRegistrationEndpoint)
        authorization_server.register_endpoint(ClientConfigurationEndpoint)
        register_grants(authorization_server)
        return authorization_server

    def query_client(self, client_id: str) -> OAuth2Client | None:
        statement = select(OAuth2Client).where(
            OAuth2Client.deleted_at.is_(None), OAuth2Client.client_id == client_id
        )
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
        sub_type, sub = typing.cast(SubTypeValue, request.user)
        client = typing.cast(OAuth2Client, request.client)
        oauth2_token = OAuth2Token(
            **token_data, client_id=client.client_id, sub_type=sub_type
        )
        oauth2_token.sub = sub
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
            client: OAuth2Client, grant_type: str, user: SubTypeValue, scope: str
        ) -> str:
            sub_type, _ = user
            return generate_token(prefix=ACCESS_TOKEN_PREFIX[sub_type])

        def _refresh_token_generator(
            client: OAuth2Client, grant_type: str, user: SubTypeValue, scope: str
        ) -> str:
            sub_type, _ = user
            return generate_token(prefix=REFRESH_TOKEN_PREFIX[sub_type])

        return BearerTokenGenerator(_access_token_generator, _refresh_token_generator)

    def create_authorization_response(
        self,
        request: Request,
        grant_user: User | None = None,
        save_consent: bool = False,
    ) -> typing.Any:
        if not isinstance(request, StarletteOAuth2Request):
            oauth2_request = self.create_oauth2_request(request)
        else:
            oauth2_request = request

        try:
            grant: AuthorizationCodeGrant = self.get_authorization_grant(oauth2_request)
        except UnsupportedResponseTypeError as error:
            return self.handle_error_response(oauth2_request, error)

        try:
            redirect_uri = grant.validate_authorization_request()
            status_code, body, headers = grant.create_authorization_response(
                redirect_uri, grant_user
            )
        except OAuth2Error as error:
            return self.handle_error_response(oauth2_request, error)

        if save_consent:
            self._save_consent(oauth2_request, grant)

        return self.handle_response(status_code, body, headers)

    def _save_consent(
        self, request: StarletteOAuth2Request, grant: AuthorizationCodeGrant
    ) -> None:
        assert grant.sub_type is not None
        assert grant.sub is not None
        assert grant.client is not None
        payload = request.payload
        assert payload is not None
        oauth2_grant_service.create_or_update_grant(
            self.session,
            sub_type=grant.sub_type,
            sub_id=grant.sub.id,
            client_id=grant.client.client_id,
            scope=payload.scope,
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
            auth_methods = auth_methods.union(
                getattr(endpoint, "CLIENT_AUTH_METHODS", [])
            )
        return list(auth_methods)

    @property
    def introspection_endpoint_auth_methods_supported(self) -> list[str]:
        auth_methods: set[str] = set()
        for endpoint in self._endpoints.get(IntrospectionEndpoint.ENDPOINT_NAME, []):
            auth_methods = auth_methods.union(
                getattr(endpoint, "CLIENT_AUTH_METHODS", [])
            )
        return list(auth_methods)

    @property
    def code_challenge_methods_supported(self) -> list[str]:
        code_challenge_methods: set[str] = set()
        for _, extensions in self._authorization_grants:
            for extension in extensions:
                if isinstance(extension, CodeChallenge):
                    code_challenge_methods = code_challenge_methods.union(
                        extension.SUPPORTED_CODE_CHALLENGE_METHOD
                    )
        return list(code_challenge_methods)
