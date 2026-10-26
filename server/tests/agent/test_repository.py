import pytest

from polar.agent.repository import AgentRepository
from polar.agent.service import CLAIM_TOKEN_PREFIX
from polar.config import settings
from polar.kit.crypto import generate_token, get_token_hash
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_agent


@pytest.mark.anyio
class TestAgentRepositoryGetByClaimToken:
    async def test_rewrites_a_claim_token_hashed_under_a_retired_secret(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(
            settings, "HASH_SECRETS", {"k1": "retired", "k2": "current"}
        )
        monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", "k1")
        token = generate_token(prefix=CLAIM_TOKEN_PREFIX)
        agent = await create_agent(
            save_fixture,
            claim_token_hash=get_token_hash(token),
        )

        monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", "k2")
        repository = AgentRepository.from_session(session)
        found = await repository.get_by_claim_token(token)

        assert found is not None
        assert found.id == agent.id

        await session.flush()
        await session.refresh(found)
        assert found.claim_token_hash == get_token_hash(token)
