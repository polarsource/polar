import time
import typing

import jwt
import structlog
from authlib.oauth2.rfc6749.errors import (
    InvalidGrantError,
    InvalidRequestError,
    InvalidScopeError,
)
from authlib.oauth2.rfc6749.grants import BaseGrant, TokenEndpointMixin
from authlib.oauth2.rfc6749.models import ClientMixin
from authlib.oauth2.rfc6749.requests import OAuth2Request
from sqlalchemy import select

from polar.auth.scope import RESERVED_SCOPES, Scope, scope_to_set
from polar.enums import Platforms
from polar.logging import Logger
from polar.models import OAuth2Token, Organization

from ..sub_type import SubType

if typing.TYPE_CHECKING:
    from ..authorization_server import AuthorizationServer

log: Logger = structlog.get_logger()


class GitHubOIDCIDToken(typing.TypedDict):
    jti: str
    sub: str
    aud: str
    iss: str
    exp: int
    repository_owner_id: int
    repository_owner: str
    actor_id: int
    actor: str


class GitHubOIDCIDTokenClient(ClientMixin):
    def __init__(self, id_token_data: GitHubOIDCIDToken):
        self.client_id = id_token_data["iss"]
        self.id_token_data = id_token_data

    def get_client_id(self) -> str:
        return self.client_id

    def get_allowed_scope(self, scope: str) -> str:
        try:
            scopes = scope_to_set(scope)
        except ValueError:
            return ""
        allowed = {s for s in Scope if s not in RESERVED_SCOPES}
        return " ".join(scopes & allowed)


_GITHUB_OIDC_JKWS_CLIENT = jwt.PyJWKClient(
    "https://token.actions.githubusercontent.com/.well-known/jwks"
)


class GitHubOIDCIDTokenGrant(BaseGrant, TokenEndpointMixin):
    server: "AuthorizationServer"

    GRANT_TYPE = "github_oidc_id_token"

    def __init__(
        self,
        request: OAuth2Request,
        server: "AuthorizationServer",
        jwks_client: jwt.PyJWKClient = _GITHUB_OIDC_JKWS_CLIENT,
    ):
        super().__init__(request, server)
        self._jwks_client = jwks_client

    def validate_token_request(self) -> None:
        log.info("Validate GitHub OIDC ID Token grant request.")

        id_token = self.request.form.get("id_token")
        if id_token is None:
            log.info("Missing id_token in request.")
            raise InvalidRequestError('Missing "id_token" in request.')

        scope = self.request.scope
        if scope is None:
            log.info("Missing scope in request.")
            raise InvalidRequestError('Missing "scope" in request.')
        try:
            scope_to_set(scope)
        except ValueError as e:
            log.info("Invalid scope.")
            raise InvalidScopeError() from e

        try:
            signing_key = self._jwks_client.get_signing_key_from_jwt(id_token)
            id_token_data: GitHubOIDCIDToken = jwt.decode(
                id_token, signing_key.key, algorithms=["RS256"], audience="polar"
            )
        except jwt.PyJWTError as e:
            log.info("Invalid id_token.", error=str(e))
            raise InvalidGrantError('Invalid "id_token".') from e

        nonce = id_token_data.get("jti")
        nonce_statement = select(OAuth2Token).where(OAuth2Token.nonce == nonce)
        result = self.server.session.execute(nonce_statement)
        if result.unique().scalar_one_or_none() is not None:
            log.info("Access token already issued for id_token.", nonce=nonce)
            raise InvalidGrantError('Invalid "id_token".')

        statement = select(Organization).where(
            Organization.platform == Platforms.github,
            Organization.slug == id_token_data["repository_owner"],
        )
        result = self.server.session.execute(statement)
        organization = result.unique().scalar_one_or_none()

        if organization is None:
            log.info(
                "Organization not found.",
                organization=id_token_data["repository_owner"],
            )
            raise InvalidGrantError('Invalid "id_token".')

        self.request.user = SubType.organization, organization  # pyright: ignore
        self.request.client = GitHubOIDCIDTokenClient(id_token_data)  # pyright: ignore

    def create_token_response(
        self,
    ) -> tuple[int, dict[str, typing.Any], list[tuple[str, str]]]:
        client = typing.cast(GitHubOIDCIDTokenClient, self.request.client)

        # Create a token with the same expiration as the id_token
        expires_in = client.id_token_data["exp"] - int(time.time())

        token = self.generate_token(
            user=self.request.user,
            scope=self.request.scope,
            include_refresh_token=False,
            expires_in=expires_in,
        )

        # Set the nonce to the jti of the id_token to prevent replay attacks
        # i.e. an access token can only be generated once for a given id_token
        self.save_token({**token, "nonce": client.id_token_data["jti"]})

        self.execute_hook("process_token", token=token)
        return 200, token, self.TOKEN_RESPONSE_HEADER
