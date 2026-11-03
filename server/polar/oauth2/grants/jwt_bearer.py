from collections.abc import Iterable
from datetime import datetime
from typing import Any
from uuid import UUID

from authlib.oauth2.rfc6749.errors import InvalidGrantError, InvalidRequestError
from authlib.oauth2.rfc6749.hooks import hooked
from authlib.oauth2.rfc7523.jwt_bearer import JWT_BEARER_GRANT_TYPE

from polar.agent.identity_assertion import decode_identity_assertion
from polar.auth.scope import CLAIMED_AGENT_SCOPES, UNCLAIMED_AGENT_SCOPES
from polar.kit import jwt
from polar.models import Agent
from polar.models.agent import AgentStatus

from ..sub_type import SubType, SubTypeValue
from .agent import AgentGrant


class JWTBearerGrant(AgentGrant):
    """Trades an agent's identity assertion for an access token (RFC 7523).

    Before the claim, it yields an agent token; after it, a token for the user who
    claimed the agent, from an assertion issued since the claim.
    """

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
        self.request.user = self._authenticate_agent(agent, claims.issued_at)

    @hooked
    def create_token_response(self) -> tuple[int, Any, Iterable[tuple[str, str]]]:
        sub_type, _ = self.request.user
        scopes = (
            UNCLAIMED_AGENT_SCOPES
            if sub_type == SubType.agent
            else CLAIMED_AGENT_SCOPES
        )
        token = self.generate_token(
            user=self.request.user,
            scope=" ".join(sorted(scopes)),
            include_refresh_token=False,
        )
        self.save_token(token)
        return 200, token, self.TOKEN_RESPONSE_HEADER

    def _get_agent(self, agent_id: UUID) -> Agent | None:
        statement = (
            self._get_agent_statement()
            .where(Agent.id == agent_id)
            .with_for_update(of=Agent)
        )
        result = self.server.session.execute(statement)
        return result.unique().scalar_one_or_none()

    def _authenticate_agent(self, agent: Agent, issued_at: datetime) -> SubTypeValue:
        if agent.can_authenticate:
            return SubType.agent, agent

        if agent.is_deleted or agent.status != AgentStatus.claimed:
            raise InvalidGrantError()

        # `iat` has whole seconds: an assertion minted in the claim's second passes.
        # Pre-claim assertions are only minted at sign-up, which a claim can't share
        # a second with: it needs a fresh human login and the code.
        assert agent.claimed_at is not None
        if issued_at < agent.claimed_at.replace(microsecond=0):
            raise InvalidGrantError()
        return SubType.user, self._get_claiming_user(agent)
