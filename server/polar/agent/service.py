import asyncio
import dataclasses
import time
import uuid
from datetime import datetime, timedelta

import structlog
from authlib.oauth2 import OAuth2Error
from authlib.oauth2.rfc7523.jwt_bearer import JWT_BEARER_GRANT_TYPE

from polar.auth.scope import CLAIMED_AGENT_SCOPES, UNCLAIMED_AGENT_SCOPES
from polar.exceptions import PolarError, ResourceNotFound
from polar.kit.crypto import (
    generate_token,
    generate_token_hash_pair,
    get_token_hash,
    get_token_hash_candidates,
)
from polar.kit.email import mask_email
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Agent, OAuth2Client, User
from polar.models.agent import AgentStatus
from polar.oauth2.constants import CLAIM_GRANT_TYPE, CLIENT_ID_PREFIX
from polar.oauth2.repository import OAuth2TokenRepository
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncReadSession, AsyncSession
from polar.posthog import posthog
from polar.product.repository import ProductRepository

from .identity_assertion import (
    IDENTITY_ASSERTION_TTL,
    create_identity_assertion,
)
from .repository import AgentRepository
from .schemas import (
    AgentClaim,
    AgentClaimConfirm,
    AgentClaimOrganization,
    AgentClaimPreview,
    AgentClaimProduct,
    AgentClaimStart,
    AgentIdentity,
    AgentIdentityCreate,
)
from .words import generate_claim_code

log: Logger = structlog.get_logger()

CLAIM_TOKEN_PREFIX = "polar_act_"
CLAIM_TOKEN_TTL = IDENTITY_ASSERTION_TTL
CLAIM_LINK_TOKEN_PREFIX = "polar_acl_"
CLAIM_TTL = timedelta(days=7)
CLAIM_PRODUCTS_LIMIT = 20


class InvalidClaimTokenError(OAuth2Error):
    error = "invalid_claim_token"
    description = "The claim token is invalid."
    status_code = 401


class ClaimExpiredError(OAuth2Error):
    error = "claim_expired"
    description = "The claim token has expired. Sign up again."
    status_code = 410


class ClaimedOrInFlightError(OAuth2Error):
    error = "claimed_or_in_flight"
    description = "The agent is already claimed."
    status_code = 409


class AgentClaimError(PolarError): ...


class AgentClaimEmailMismatch(AgentClaimError):
    def __init__(self, email: str) -> None:
        super().__init__(
            f"This claim was started for {mask_email(email)}. Sign in with that "
            "email to claim the agent.",
            403,
        )


class AgentClaimExpired(AgentClaimError):
    def __init__(self) -> None:
        super().__init__(
            "This claim has expired. Ask the agent to start a new one.", 410
        )


class AgentClaimInvalidCode(AgentClaimError):
    def __init__(self) -> None:
        super().__init__("This code is wrong.", 400)


@dataclasses.dataclass(frozen=True)
class AgentClaimAttempt:
    id: uuid.UUID
    agent: Agent
    link_token: str
    code: str
    expires_at: datetime


class AgentService:
    async def create_anonymous(
        self,
        session: AsyncSession,
        identity_create: AgentIdentityCreate,
        *,
        claim_url: str,
    ) -> AgentIdentity:
        oauth2_client = OAuth2Client(
            client_id=generate_token(prefix=CLIENT_ID_PREFIX),
            client_id_issued_at=int(time.time()),
        )
        oauth2_client.set_client_metadata(
            {
                "client_name": identity_create.name or "Agent",
                "token_endpoint_auth_method": "none",
                "redirect_uris": [],
                "grant_types": [JWT_BEARER_GRANT_TYPE, CLAIM_GRANT_TYPE],
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
        posthog.agent_event(agent, "signup", "done")
        return AgentIdentity(
            registration_id=agent.id,
            registration_type="anonymous",
            identity_assertion=identity_assertion.token,
            assertion_expires=identity_assertion.expires_at,
            pre_claim_scopes=sorted(UNCLAIMED_AGENT_SCOPES),
            claim_url=claim_url,
            claim_token=claim_token,
            claim_token_expires=claim_token_expires_at,
            post_claim_scopes=sorted(CLAIMED_AGENT_SCOPES),
        )

    async def start_claim(
        self, session: AsyncSession, claim_start: AgentClaimStart
    ) -> AgentClaimAttempt:
        """Issue the human's link and code, replacing any previous ones."""
        repository = AgentRepository.from_session(session)
        agent = await repository.get_by_claim_token(claim_start.claim_token)
        now = utc_now()
        if agent is None or agent.status == AgentStatus.revoked:
            raise InvalidClaimTokenError()
        if agent.status == AgentStatus.claimed:
            raise ClaimedOrInFlightError()
        if (
            agent.claim_token_expires_at is not None
            and agent.claim_token_expires_at <= now
        ):
            raise ClaimExpiredError()

        link_token, link_token_hash = generate_token_hash_pair(
            prefix=CLAIM_LINK_TOKEN_PREFIX
        )
        code = generate_claim_code()
        expires_at = now + CLAIM_TTL
        agent = await repository.update(
            agent,
            update_dict={
                "claim_email": claim_start.email,
                "claim_link_token_hash": link_token_hash,
                "claim_code_hash": get_token_hash(code),
                "claim_expires_at": expires_at,
            },
        )
        log.info("agent.claim.started", agent_id=agent.id)
        posthog.agent_event(
            agent,
            "claim",
            "start",
            {"has_organization": agent.organization_id is not None},
        )
        return AgentClaimAttempt(
            id=uuid.uuid4(),
            agent=agent,
            link_token=link_token,
            code=code,
            expires_at=expires_at,
        )

    async def preview_claim(
        self, session: AsyncReadSession, link_token: str
    ) -> AgentClaimPreview:
        repository = AgentRepository.from_session(session)
        agent = self._validate_claim_link(
            await repository.get_by_claim_link_token(link_token)
        )
        assert agent.claim_email is not None
        assert agent.claim_expires_at is not None
        return AgentClaimPreview(
            agent_name=agent.name,
            email=mask_email(agent.claim_email),
            expires_at=agent.claim_expires_at,
            organization=self._claim_organization(agent),
        )

    async def get_claim(
        self, session: AsyncReadSession, user: User, link_token: str
    ) -> AgentClaim:
        repository = AgentRepository.from_session(session)
        agent = self._validate_claim(
            await repository.get_by_claim_link_token(link_token), user
        )
        assert agent.claim_email is not None
        assert agent.claim_expires_at is not None
        products = (
            await ProductRepository.from_session(session).get_all_by_organization(
                agent.organization.id, limit=CLAIM_PRODUCTS_LIMIT
            )
            if agent.organization is not None
            else []
        )
        return AgentClaim(
            agent_name=agent.name,
            email=agent.claim_email,
            expires_at=agent.claim_expires_at,
            organization=self._claim_organization(agent),
            products=[
                AgentClaimProduct.model_validate(product) for product in products
            ],
        )

    async def confirm_claim(
        self, session: AsyncSession, user: User, claim_confirm: AgentClaimConfirm
    ) -> Agent:
        """Make `user` the owner of the agent and its organization."""
        repository = AgentRepository.from_session(session)
        agent = self._validate_claim(
            await repository.get_by_claim_link_token(
                claim_confirm.link_token, for_update=True
            ),
            user,
        )

        candidates = get_token_hash_candidates(claim_confirm.code)
        if agent.claim_code_hash not in candidates.values():
            raise AgentClaimInvalidCode()

        agent = await repository.update(
            agent,
            update_dict={
                "status": AgentStatus.claimed,
                "claimed_by_user": user,
                "claimed_at": utc_now(),
                "claim_link_token_hash": None,
                "claim_code_hash": None,
            },
        )

        oauth2_client = agent.oauth2_client
        oauth2_client.set_client_metadata(
            {
                **oauth2_client.client_metadata,
                "scope": " ".join(sorted(CLAIMED_AGENT_SCOPES)),
            }
        )
        oauth2_token_repository = OAuth2TokenRepository.from_session(session)
        await oauth2_token_repository.revoke_by_agent(agent.id)

        if agent.organization is not None:
            await organization_service.set_up_for_owner(
                session, agent.organization, user
            )

        log.info(
            "agent.claim.confirmed",
            agent_id=agent.id,
            user_id=user.id,
            organization_id=agent.organization_id,
        )
        organization_id = str(agent.organization_id) if agent.organization_id else None
        posthog.agent_event(
            agent,
            "claim",
            "done",
            {"user_id": str(user.id), "organization_id": organization_id},
        )
        posthog.user_event(
            user,
            "agent",
            "claim",
            "done",
            {"agent_id": str(agent.id), "organization_id": organization_id},
        )
        return agent

    def _validate_claim_link(self, agent: Agent | None) -> Agent:
        if agent is None or agent.status != AgentStatus.unclaimed:
            raise ResourceNotFound()

        assert agent.claim_expires_at is not None
        if agent.claim_expires_at <= utc_now():
            raise AgentClaimExpired()
        return agent

    def _validate_claim(self, agent: Agent | None, user: User) -> Agent:
        agent = self._validate_claim_link(agent)
        assert agent.claim_email is not None
        if agent.claim_email.lower() != user.email.lower():
            raise AgentClaimEmailMismatch(agent.claim_email)
        return agent

    def _claim_organization(self, agent: Agent) -> AgentClaimOrganization | None:
        organization = agent.organization
        if organization is None:
            return None
        return AgentClaimOrganization(
            id=organization.id,
            name=organization.name,
            slug=organization.slug,
            avatar_url=organization.avatar_url,
        )


agent = AgentService()
