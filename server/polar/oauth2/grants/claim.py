from collections.abc import Iterable
from datetime import timedelta
from typing import Any

from authlib.oauth2.rfc6749.errors import InvalidGrantError, InvalidRequestError
from authlib.oauth2.rfc6749.hooks import hooked
from authlib.oauth2.rfc8628 import (
    AuthorizationPendingError,
    ExpiredTokenError,
    SlowDownError,
)

from polar.agent.identity_assertion import create_identity_assertion
from polar.auth.scope import CLAIMED_AGENT_SCOPES
from polar.kit.crypto import get_token_hash_candidates
from polar.kit.utils import utc_now
from polar.models import Agent
from polar.models.agent import AgentStatus

from ..constants import CLAIM_GRANT_TYPE, CLAIM_POLL_INTERVAL
from ..sub_type import SubType
from .agent import AgentGrant


class ClaimGrant(AgentGrant):
    """The agent polls with its claim token until a human claims it (auth.md).

    Once claimed, it gets the claiming user's access token and a new identity
    assertion, and the claim token stops working.
    """

    GRANT_TYPE = CLAIM_GRANT_TYPE

    agent: Agent

    def validate_token_request(self) -> None:
        claim_token = self.request.form.get("claim_token")
        if not claim_token:
            raise InvalidRequestError("Missing 'claim_token' in request.")

        agent = self._get_agent(claim_token)
        if agent is None or agent.status == AgentStatus.revoked:
            raise InvalidGrantError()

        client = agent.oauth2_client
        self._validate_request_client(client)

        now = utc_now()
        polled_at = agent.claim_polled_at
        agent.claim_polled_at = now
        self.server.session.add(agent)
        self.server.session.flush()
        if polled_at is not None and polled_at > now - timedelta(
            seconds=CLAIM_POLL_INTERVAL
        ):
            raise SlowDownError()

        if agent.status == AgentStatus.unclaimed:
            for expires_at in (agent.claim_token_expires_at, agent.claim_expires_at):
                if expires_at is not None and expires_at <= now:
                    raise ExpiredTokenError()
            raise AuthorizationPendingError()

        self.agent = agent
        self.request.client = client
        self.request.user = SubType.user, self._get_claiming_user(agent)

    @hooked
    def create_token_response(self) -> tuple[int, Any, Iterable[tuple[str, str]]]:
        self.agent.claim_token_hash = None
        self.agent.claim_token_expires_at = None

        token = self.generate_token(
            user=self.request.user,
            scope=" ".join(sorted(CLAIMED_AGENT_SCOPES)),
            include_refresh_token=False,
        )
        self.save_token(token)

        identity_assertion = create_identity_assertion(self.agent.id)
        return (
            200,
            {
                **token,
                "identity_assertion": identity_assertion.token,
                "assertion_expires": identity_assertion.expires_at.isoformat(),
            },
            self.TOKEN_RESPONSE_HEADER,
        )

    def _get_agent(self, claim_token: str) -> Agent | None:
        candidates = get_token_hash_candidates(claim_token)
        statement = (
            self._get_agent_statement()
            .where(
                Agent.claim_token_hash.in_(candidates.values()),
                ~Agent.is_deleted,
            )
            .with_for_update(of=Agent)
        )
        result = self.server.session.execute(statement)
        return result.unique().scalar_one_or_none()
