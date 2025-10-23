import uuid
from collections.abc import Iterable
from typing import Any

from authlib.oauth2.rfc6749 import ClientMixin
from authlib.oauth2.rfc6749.errors import (
    InvalidGrantError,
    InvalidRequestError,
    UnauthorizedClientError,
)
from authlib.oauth2.rfc6749.grants import BaseGrant, TokenEndpointMixin
from authlib.oauth2.rfc6749.hooks import hooked
from sqlalchemy import and_, select

from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import Organization, User, UserOrganization, UserSession

from ..sub_type import SubType, SubTypeValue


class WebGrant(BaseGrant, TokenEndpointMixin):
    GRANT_TYPE = "web"
    TOKEN_ENDPOINT_AUTH_METHODS = ["client_secret_basic", "client_secret_post"]

    def validate_token_request(self) -> None:
        client = self._validate_request_client()
        self.request.client = client
        sub_type_value = self._validate_request_token(client)
        self.request.user = sub_type_value

    @hooked
    def create_token_response(self) -> tuple[int, Any, Iterable[tuple[str, str]]]:
        client = self.request.client
        sub_type_value = self.request.user
        scope = self.request.payload.scope or client.scope

        token = self.generate_token(
            user=sub_type_value, scope=scope, include_refresh_token=False
        )
        self.save_token(token)

        return 200, token, self.TOKEN_RESPONSE_HEADER

    def _validate_request_client(self) -> ClientMixin:
        client = self.authenticate_token_endpoint_client()

        if not client.check_grant_type(self.GRANT_TYPE):
            raise UnauthorizedClientError(
                f"The client is not authorized to use 'grant_type={self.GRANT_TYPE}'"
            )

        return client

    def _validate_request_token(self, client: ClientMixin) -> SubTypeValue:
        payload = self.request.payload
        if payload is None:
            raise InvalidRequestError("Missing request payload.")

        data = payload.data
        token = data.get("session_token")
        if token is None:
            raise InvalidRequestError("Missing 'session_token' in request.")

        sub_type: str | None = data.get("sub_type")
        try:
            sub_type = SubType(sub_type) if sub_type else SubType.user
        except ValueError as e:
            raise InvalidRequestError("Invalid sub_type") from e

        sub: str | None = data.get("sub")
        if sub_type == SubType.organization and sub is None:
            raise InvalidRequestError("Missing 'sub' for organization sub_type")
        elif sub_type == SubType.user and sub is not None:
            raise InvalidRequestError("Can't specify 'sub' for user sub_type")

        scope = data.get("scope", "")
        if scope:
            self.server.validate_requested_scope(scope)

        token = get_token_hash(token, secret=settings.SECRET)
        statement = select(UserSession).where(
            UserSession.token == token, UserSession.expires_at > utc_now()
        )
        result = self.server.session.execute(statement)
        user_session: UserSession | None = result.unique().scalar_one_or_none()
        if user_session is None:
            raise InvalidGrantError()

        user = user_session.user
        sub_value: User | Organization | None = None
        if sub_type == SubType.user:
            sub_value = user
        elif sub_type == SubType.organization:
            assert sub is not None
            try:
                sub_uuid = uuid.UUID(sub)
            except ValueError as e:
                raise InvalidRequestError("Invalid 'sub' UUID") from e
            organization = self._get_organization_admin(sub_uuid, user)
            if organization is None:
                raise InvalidGrantError()
            sub_value = organization

        assert sub_value is not None
        return sub_type, sub_value

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
        result = self.server.session.execute(statement)
        return result.unique().scalar_one_or_none()
