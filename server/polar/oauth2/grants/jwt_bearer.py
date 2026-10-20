import typing
from collections.abc import Iterable
from typing import Any
from uuid import UUID

from authlib.oauth2.rfc6749.errors import (
    InvalidClientError,
    InvalidGrantError,
    InvalidRequestError,
    UnauthorizedClientError,
)
from authlib.oauth2.rfc6749.grants import BaseGrant, TokenEndpointMixin
from authlib.oauth2.rfc6749.hooks import hooked
from authlib.oauth2.rfc6749.util import extract_basic_authorization
from authlib.oauth2.rfc7523.jwt_bearer import JWT_BEARER_GRANT_TYPE
from sqlalchemy import select
from sqlalchemy.orm import contains_eager

from polar.agent.identity_assertion import decode_identity_assertion
from polar.auth.scope import UNCLAIMED_AGENT_SCOPES
from polar.kit import jwt
from polar.models import Agent, OAuth2Client

from ..sub_type import SubType, SubTypeValue

if typing.TYPE_CHECKING:
    from ..authorization_server import AuthorizationServer


class JWTBearerGrant(BaseGrant, TokenEndpointMixin):
    """Trades an agent's identity assertion for an access token (RFC 7523).

    The client is the agent's own, never one the caller names, so no other OAuth
    app can use this grant.
    """

    server: "AuthorizationServer"

    GRANT_TYPE = JWT_BEARER_GRANT_TYPE

    def validate_token_request(self) -> None:
        assertion = self.request.form.get("assertion")
        if not assertion:
            raise InvalidRequestError("Missing 'assertion' in request.")

        try:
            claims = decode_identity_assertion(assertion)
        except jwt.InvalidTokenError as e:
            raise InvalidGrantError() from e

        agent = self._get_agent(claims.agent_id)
        if agent is None:
            raise InvalidGrantError()

        client = agent.oauth2_client
        self._validate_request_client(client)
        self.request.client = client
        self.request.user = self._authenticate_agent(agent)

    @hooked
    def create_token_response(self) -> tuple[int, Any, Iterable[tuple[str, str]]]:
        token = self.generate_token(
            user=self.request.user,
            scope=" ".join(sorted(UNCLAIMED_AGENT_SCOPES)),
            include_refresh_token=False,
        )
        self.save_token(token)
        return 200, token, self.TOKEN_RESPONSE_HEADER

    def _get_agent(self, agent_id: UUID) -> Agent | None:
        statement = (
            select(Agent)
            .join(Agent.oauth2_client)
            .where(Agent.id == agent_id, ~OAuth2Client.is_deleted)
            .options(contains_eager(Agent.oauth2_client))
        )
        result = self.server.session.execute(statement)
        return result.unique().scalar_one_or_none()

    def _validate_request_client(self, client: OAuth2Client) -> None:
        basic_client_id, _ = extract_basic_authorization(self.request.headers)
        for client_id in (self.request.payload.client_id, basic_client_id):
            if client_id is not None and client_id != client.client_id:
                raise InvalidClientError()

        if not client.check_grant_type(self.GRANT_TYPE):
            raise UnauthorizedClientError(
                f"The client is not authorized to use 'grant_type={self.GRANT_TYPE}'"
            )

    def _authenticate_agent(self, agent: Agent) -> SubTypeValue:
        if not agent.can_authenticate:
            raise InvalidGrantError()
        return SubType.agent, agent
