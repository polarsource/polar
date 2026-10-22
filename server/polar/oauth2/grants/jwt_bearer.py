from collections.abc import Iterable
from typing import Any
from uuid import UUID

from authlib.oauth2.rfc6749.errors import InvalidGrantError, InvalidRequestError
from authlib.oauth2.rfc6749.hooks import hooked
from authlib.oauth2.rfc7523.jwt_bearer import JWT_BEARER_GRANT_TYPE

from polar.agent.identity_assertion import decode_identity_assertion
from polar.auth.scope import UNCLAIMED_AGENT_SCOPES
from polar.kit import jwt
from polar.models import Agent

from ..sub_type import SubType, SubTypeValue
from .agent import AgentGrant


class JWTBearerGrant(AgentGrant):
    """Trades an agent's identity assertion for an access token (RFC 7523)."""

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
        statement = self._get_agent_statement().where(Agent.id == agent_id)
        result = self.server.session.execute(statement)
        return result.unique().scalar_one_or_none()

    def _authenticate_agent(self, agent: Agent) -> SubTypeValue:
        if not agent.can_authenticate:
            raise InvalidGrantError()
        return SubType.agent, agent
