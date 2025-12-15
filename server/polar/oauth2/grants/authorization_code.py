import typing
import uuid

from authlib.oauth2.rfc6749.errors import (
    AccessDeniedError,
    InvalidRequestError,
    OAuth2Error,
)
from authlib.oauth2.rfc6749.grants import (
    AuthorizationCodeGrant as _AuthorizationCodeGrant,
)
from authlib.oauth2.rfc6749.requests import OAuth2Request
from authlib.oauth2.rfc7636 import CodeChallenge as _CodeChallenge
from authlib.oidc.core.errors import ConsentRequiredError, LoginRequiredError
from authlib.oidc.core.grants import OpenIDCode as _OpenIDCode
from authlib.oidc.core.grants import OpenIDToken as _OpenIDToken
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from polar.config import settings
from polar.kit.crypto import generate_token, get_token_hash
from polar.models import (
    OAuth2AuthorizationCode,
    OAuth2Client,
    Organization,
    User,
    UserOrganization,
)

from ..constants import AUTHORIZATION_CODE_PREFIX, JWT_CONFIG
from ..requests import StarletteOAuth2Request
from ..service.oauth2_grant import oauth2_grant as oauth2_grant_service
from ..sub_type import SubType, SubTypeValue
from ..userinfo import UserInfo, generate_user_info

if typing.TYPE_CHECKING:
    from ..authorization_server import AuthorizationServer


def _exists_nonce(
    session: Session, nonce: str, request: StarletteOAuth2Request
) -> bool:
    statement = select(OAuth2AuthorizationCode).where(
        OAuth2AuthorizationCode.client_id == request.client_id,
        OAuth2AuthorizationCode.nonce == nonce,
    )
    result = session.execute(statement)
    return result.unique().scalar_one_or_none() is not None


class SubTypeGrantMixin:
    sub_type: SubType | None = None
    sub: User | Organization | None = None


class AuthorizationCodeGrant(SubTypeGrantMixin, _AuthorizationCodeGrant):
    server: "AuthorizationServer"
    TOKEN_ENDPOINT_AUTH_METHODS = ["client_secret_basic", "client_secret_post", "none"]

    def __init__(self, request: OAuth2Request, server: "AuthorizationServer") -> None:
        super().__init__(request, server)
        self._hooks["before_create_authorization_response"] = set()
        self._hooks["before_validate_authorization_request_payload"] = {
            self.before_validate_authorization_request_payload
        }

    def before_validate_authorization_request_payload(
        self, grant: "typing.Self", redirect_uri: str
    ) -> None:
        """
        If no scope is provided in the authorization request,
        default to the client's scope.
        """
        payload = self.request.payload
        scope: str | None = payload.data.get("scope")
        if scope is None:
            self.request.payload.data["scope"] = self.request.client.scope

    def create_authorization_response(
        self, redirect_uri: str, grant_user: User | None
    ) -> tuple[int, str | dict[str, typing.Any], list[tuple[str, str]]]:
        payload = self.request.payload
        assert payload is not None

        if not grant_user:
            raise AccessDeniedError(state=payload.state, redirect_uri=redirect_uri)

        self.request.user = grant_user  # pyright: ignore

        self.execute_hook(
            "before_create_authorization_response", redirect_uri, grant_user
        )
        return super().create_authorization_response(redirect_uri, grant_user)  # pyright: ignore

    def generate_authorization_code(self) -> str:
        return generate_token(prefix=AUTHORIZATION_CODE_PREFIX)

    def save_authorization_code(
        self, code: str, request: StarletteOAuth2Request
    ) -> OAuth2AuthorizationCode:
        payload = request.payload
        assert payload is not None

        nonce = payload.data.get("nonce")
        code_challenge = payload.data.get("code_challenge")
        code_challenge_method = payload.data.get("code_challenge_method")

        assert self.sub_type is not None
        assert self.sub is not None

        authorization_code = OAuth2AuthorizationCode(
            code=get_token_hash(code, secret=settings.SECRET),
            client_id=payload.client_id,
            sub_type=self.sub_type,
            scope=payload.scope,
            redirect_uri=payload.redirect_uri,
            nonce=nonce,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
        )
        authorization_code.sub = self.sub

        self.server.session.add(authorization_code)
        self.server.session.flush()
        return authorization_code

    def query_authorization_code(
        self, code: str, client: OAuth2Client
    ) -> OAuth2AuthorizationCode | None:
        code_hash = get_token_hash(code, secret=settings.SECRET)
        statement = select(OAuth2AuthorizationCode).where(
            OAuth2AuthorizationCode.code == code_hash,
            OAuth2AuthorizationCode.client_id == client.client_id,
        )
        result = self.server.session.execute(statement)
        authorization_code = result.unique().scalar_one_or_none()
        if authorization_code is not None and not typing.cast(
            bool, authorization_code.is_expired()
        ):
            return authorization_code
        return None

    def delete_authorization_code(
        self, authorization_code: OAuth2AuthorizationCode
    ) -> None:
        self.server.session.delete(authorization_code)
        self.server.session.flush()

    def authenticate_user(
        self, authorization_code: OAuth2AuthorizationCode
    ) -> SubTypeValue | None:
        return authorization_code.get_sub_type_value()


class CodeChallenge(_CodeChallenge):
    pass


class OpenIDCode(_OpenIDCode):
    def __init__(self, session: Session, require_nonce: bool = False):
        super().__init__(require_nonce)
        self._session = session

    def exists_nonce(self, nonce: str, request: StarletteOAuth2Request) -> bool:
        return _exists_nonce(self._session, nonce, request)

    def get_jwt_config(self, grant: AuthorizationCodeGrant) -> dict[str, typing.Any]:
        return JWT_CONFIG

    def generate_user_info(self, user: SubTypeValue, scope: str) -> UserInfo:
        return generate_user_info(user, scope)


class OpenIDToken(_OpenIDToken):
    def get_jwt_config(self, grant: AuthorizationCodeGrant) -> dict[str, typing.Any]:
        return JWT_CONFIG

    def generate_user_info(self, user: SubTypeValue, scope: str) -> UserInfo:
        return generate_user_info(user, scope)


class InvalidSubError(OAuth2Error):
    error = "invalid_sub"


class ValidateSubAndPrompt:
    def __init__(self, session: Session) -> None:
        self._session = session

    def __call__(self, grant: AuthorizationCodeGrant) -> None:
        grant.register_hook("after_validate_consent_request", self._validate)
        grant.register_hook(
            "before_create_authorization_response", self._validate_resolved_sub
        )

    def _validate(
        self,
        grant: AuthorizationCodeGrant,
        redirect_uri: str,
        redirect_fragment: bool = False,
    ) -> None:
        self._validate_sub(grant, redirect_uri, redirect_fragment)
        self._validate_scope_consent(grant, redirect_uri, redirect_fragment)

    def _validate_sub(
        self,
        grant: AuthorizationCodeGrant,
        redirect_uri: str,
        redirect_fragment: bool = False,
    ) -> None:
        payload = grant.request.payload
        assert payload is not None

        sub_type: str | None = payload.data.get("sub_type")
        if sub_type:
            try:
                grant.sub_type = SubType(sub_type)
            except ValueError as e:
                raise InvalidRequestError("Invalid sub_type") from e
        else:
            client: OAuth2Client = typing.cast(OAuth2Client, grant.client)
            grant.sub_type = client.default_sub_type

        sub: str | None = payload.data.get("sub")
        user = grant.request.user

        if grant.sub_type == SubType.user:
            grant.sub = user
            if sub is not None:
                raise InvalidRequestError("Can't specify sub for user sub_type")
        elif (
            grant.sub_type == SubType.organization
            and sub is not None
            and user is not None
        ):
            try:
                sub_uuid = uuid.UUID(sub)
            except ValueError as e:
                raise InvalidSubError() from e
            organization = self._get_organization_admin(sub_uuid, user)
            if organization is None:
                raise InvalidSubError()
            grant.sub = organization

    def _validate_scope_consent(
        self,
        grant: AuthorizationCodeGrant,
        redirect_uri: str,
        redirect_fragment: bool = False,
    ) -> None:
        # First party clients always skip consent
        client = grant.client
        assert client is not None
        first_party: bool = client.first_party
        if first_party and grant.sub_type is not None and grant.sub is not None:
            grant.prompt = "none"
            # Implicitly save the grant to all the scopes
            oauth2_grant_service.create_or_update_grant(
                self._session,
                sub_type=grant.sub_type,
                sub_id=grant.sub.id,
                client_id=grant.client.client_id,
                scope=client.scope,
            )
            return

        payload = grant.request.payload
        assert payload is not None

        prompt = payload.data.get("prompt")

        # Check if the sub has granted the requested scope or a subset of it
        has_granted_scope = False
        if grant.sub is not None:
            assert grant.client is not None
            assert grant.sub_type is not None
            has_granted_scope = oauth2_grant_service.has_granted_scope(
                self._session,
                sub_type=grant.sub_type,
                sub_id=grant.sub.id,
                client_id=grant.client.client_id,
                scope=payload.scope,
            )

        # If the prompt is "none", the sub must be authenticated and have granted the requested scope
        if prompt == "none":
            if grant.sub is None:
                raise LoginRequiredError(
                    redirect_uri=redirect_uri, redirect_fragment=redirect_fragment
                )
            if not has_granted_scope:
                raise ConsentRequiredError(
                    redirect_uri=redirect_uri, redirect_fragment=redirect_fragment
                )

        # Bypass everything if nothing is specified and conditions are met
        if prompt is None and has_granted_scope:
            grant.prompt = "none"

    def _validate_resolved_sub(
        self,
        grant: AuthorizationCodeGrant,
        redirect_uri: str,
        redirect_fragment: bool = False,
    ) -> None:
        self._validate_sub(grant, redirect_uri, redirect_fragment)
        if grant.sub is None:
            raise InvalidSubError()

    def _get_organization_admin(
        self, organization_id: uuid.UUID, user: User
    ) -> Organization | None:
        statement = (
            select(Organization)
            .join(
                UserOrganization,
                onclause=and_(
                    UserOrganization.user_id == user.id,
                    UserOrganization.deleted_at.is_(None),
                ),
            )
            .where(Organization.id == organization_id)
        )
        result = self._session.execute(statement)
        return result.unique().scalar_one_or_none()
