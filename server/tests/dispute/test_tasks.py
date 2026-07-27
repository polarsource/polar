import contextlib
from collections.abc import AsyncIterator

import pytest
from pytest_mock import MockerFixture

from polar.dispute.dispute_case import DISPUTE_GREETING
from polar.dispute.tasks import post_dispute_greeting
from polar.models import Customer, Organization, Product
from polar.models.support_case import SupportCaseMessageAuthorKind
from polar.postgres import AsyncSession
from polar.support_case.repository import SupportCaseMessageRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_dispute_case

_post_dispute_greeting = post_dispute_greeting.__wrapped__  # type: ignore[attr-defined]


@contextlib.asynccontextmanager
async def _session_maker(session: AsyncSession) -> AsyncIterator[AsyncSession]:
    yield session


@pytest.mark.asyncio
class TestPostDisputeGreeting:
    async def test_posts_greeting(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        mocker.patch(
            "polar.dispute.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await _post_dispute_greeting(case.id)
        await session.flush()

        messages = await SupportCaseMessageRepository.from_session(
            session
        ).list_by_case(case.id, visible_to=None)
        greetings = [
            message for message in messages if message.body == DISPUTE_GREETING
        ]
        assert len(greetings) == 1
        assert greetings[0].author_kind == SupportCaseMessageAuthorKind.system

    async def test_idempotent(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        mocker.patch(
            "polar.dispute.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )

        await _post_dispute_greeting(case.id)
        await _post_dispute_greeting(case.id)
        await session.flush()

        messages = await SupportCaseMessageRepository.from_session(
            session
        ).list_by_case(case.id, visible_to=None)
        greetings = [
            message for message in messages if message.body == DISPUTE_GREETING
        ]
        assert len(greetings) == 1
