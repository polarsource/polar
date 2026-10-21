import asyncio
import dataclasses
import time
from datetime import datetime, timedelta

from authlib.oauth2.rfc7523.jwt_bearer import JWT_BEARER_GRANT_TYPE

from polar.auth.scope import UNCLAIMED_AGENT_SCOPES
from polar.kit.crypto import generate_token, generate_token_hash_pair
from polar.kit.utils import utc_now
from polar.models import Agent, OAuth2Client
from polar.oauth2.constants import CLIENT_ID_PREFIX
from polar.postgres import AsyncSession

from .identity_assertion import IdentityAssertion, create_identity_assertion
from .repository import AgentRepository
from .schemas import AgentIdentityCreate

CLAIM_TOKEN_PREFIX = "polar_act_"
CLAIM_TOKEN_TTL = timedelta(days=7)


@dataclasses.dataclass(frozen=True)
class AgentSignUp:
    agent: Agent
    identity_assertion: IdentityAssertion
    claim_token: str
    claim_token_expires_at: datetime


class AgentService:
    async def create_anonymous(
        self, session: AsyncSession, identity_create: AgentIdentityCreate
    ) -> AgentSignUp:
        oauth2_client = OAuth2Client(
            client_id=generate_token(prefix=CLIENT_ID_PREFIX),
            client_id_issued_at=int(time.time()),
        )
        oauth2_client.set_client_metadata(
            {
                "client_name": identity_create.name or "Agent",
                "token_endpoint_auth_method": "none",
                "redirect_uris": [],
                "grant_types": [JWT_BEARER_GRANT_TYPE],
                "response_types": [],
                "scope": " ".join(sorted(UNCLAIMED_AGENT_SCOPES)),
            }
        )

        claim_token, claim_token_hash = generate_token_hash_pair(
            prefix=CLAIM_TOKEN_PREFIX
        )
        claim_token_expires_at = utc_now() + CLAIM_TOKEN_TTL
        repository = AgentRepository.from_session(session)
        agent = await repository.create(
            Agent(
                name=identity_create.name,
                oauth2_client=oauth2_client,
                claim_token_hash=claim_token_hash,
                claim_token_expires_at=claim_token_expires_at,
            ),
            flush=True,
        )

        identity_assertion = await asyncio.to_thread(
            create_identity_assertion, agent.id
        )
        return AgentSignUp(
            agent=agent,
            identity_assertion=identity_assertion,
            claim_token=claim_token,
            claim_token_expires_at=claim_token_expires_at,
        )


agent = AgentService()
