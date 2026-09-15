from datetime import timedelta
from typing import Any, Self

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import Update

from polar.kit.utils import utc_now
from polar.models import Account, Transaction
from polar.models.transaction import TransactionType
from polar.postgres import AsyncSession
from polar.transaction.repository import TransactionRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_balance_transaction
from tests.transaction.conftest import create_transaction

ten_days_ago = utc_now() - timedelta(days=10)


async def _create_payout_target(
    save_fixture: SaveFixture, account: Account
) -> Transaction:
    return await create_transaction(
        save_fixture, account=account, type=TransactionType.payout
    )


@pytest.mark.asyncio
class TestSetUnpaidTransactionsPayout:
    async def test_empty_selection(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        payout_transaction = await _create_payout_target(save_fixture, account)
        execute_spy = mocker.spy(session, "execute")

        repository = TransactionRepository.from_session(session)
        await repository.set_unpaid_transactions_payout(
            account.id, payout_transaction.id
        )

        # No eligible rows => no UPDATE statement is emitted.
        update_calls = [
            call
            for call in execute_spy.call_args_list
            if isinstance(call.args[0], Update)
        ]
        assert update_calls == []

    async def test_marks_eligible_transactions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
    ) -> None:
        payout_transaction = await _create_payout_target(save_fixture, account)
        eligible = [
            await create_balance_transaction(
                save_fixture, account=account, created_at=ten_days_ago
            )
            for _ in range(3)
        ]
        # Not eligible: created recently, still within the payout delay window.
        recent = await create_balance_transaction(
            save_fixture, account=account, created_at=utc_now()
        )

        repository = TransactionRepository.from_session(session)
        await repository.set_unpaid_transactions_payout(
            account.id, payout_transaction.id
        )

        for transaction in eligible:
            await session.refresh(transaction)
            assert transaction.payout_transaction_id == payout_transaction.id

        await session.refresh(recent)
        assert recent.payout_transaction_id is None

    async def test_multiple_batches(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch("polar.transaction.repository._PAYOUT_UPDATE_BATCH_SIZE", 2)
        payout_transaction = await _create_payout_target(save_fixture, account)
        eligible = [
            await create_balance_transaction(
                save_fixture, account=account, created_at=ten_days_ago
            )
            for _ in range(5)
        ]
        execute_spy = mocker.spy(session, "execute")

        repository = TransactionRepository.from_session(session)
        await repository.set_unpaid_transactions_payout(
            account.id, payout_transaction.id
        )

        update_calls = [
            call
            for call in execute_spy.call_args_list
            if isinstance(call.args[0], Update)
        ]
        # 5 rows, batch size 2 => 3 UPDATE statements.
        assert len(update_calls) == 3

        for transaction in eligible:
            await session.refresh(transaction)
            assert transaction.payout_transaction_id == payout_transaction.id

    async def test_does_not_commit(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        payout_transaction = await _create_payout_target(save_fixture, account)
        await create_balance_transaction(
            save_fixture, account=account, created_at=ten_days_ago
        )
        commit_spy = mocker.spy(session, "commit")

        repository = TransactionRepository.from_session(session)
        await repository.set_unpaid_transactions_payout(
            account.id, payout_transaction.id
        )

        # Atomicity: the whole selection + batched update stays in one
        # transaction; the repository never commits between batches.
        commit_spy.assert_not_called()

    async def test_update_error_propagates(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        payout_transaction = await _create_payout_target(save_fixture, account)
        await create_balance_transaction(
            save_fixture, account=account, created_at=ten_days_ago
        )

        original_execute = session.execute

        async def failing_execute(*args: Any, **kwargs: Any) -> Any:
            if args and isinstance(args[0], Update):
                raise RuntimeError("update failed")
            return await original_execute(*args, **kwargs)

        mocker.patch.object(session, "execute", side_effect=failing_execute)

        repository = TransactionRepository.from_session(session)
        with pytest.raises(RuntimeError, match="update failed"):
            await repository.set_unpaid_transactions_payout(
                account.id, payout_transaction.id
            )


@pytest.mark.asyncio
class TestGetBackendPid:
    async def test_returns_session_backend_pid(self, session: AsyncSession) -> None:
        repository = TransactionRepository.from_session(session)
        pid = await repository._get_backend_pid()
        assert isinstance(pid, int)

    async def test_does_not_flush_pending_orm_state(
        self, session: AsyncSession
    ) -> None:
        # The PID is read from the driver connection's startup metadata, never a
        # probe query: a probe would autoflush pending ORM state (and, on error,
        # could leave the payout transaction aborted). Assert no flush happens.
        repository = TransactionRepository.from_session(session)
        pending = Transaction()  # missing NOT NULL columns -> would fail on flush
        session.add(pending)

        pid = await repository._get_backend_pid()

        assert isinstance(pid, int)
        assert pending in session.new  # still pending: it was never flushed
        session.expunge(pending)

    async def test_probe_failure_returns_none(
        self, session: AsyncSession, mocker: MockerFixture
    ) -> None:
        repository = TransactionRepository.from_session(session)
        mocker.patch.object(
            session, "connection", side_effect=RuntimeError("no connection")
        )

        assert await repository._get_backend_pid() is None

    async def test_payout_succeeds_when_pid_unavailable(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        payout_transaction = await _create_payout_target(save_fixture, account)
        eligible = await create_balance_transaction(
            save_fixture, account=account, created_at=ten_days_ago
        )
        repository = TransactionRepository.from_session(session)
        mocker.patch.object(repository, "_get_backend_pid", return_value=None)

        await repository.set_unpaid_transactions_payout(
            account.id, payout_transaction.id
        )

        await session.refresh(eligible)
        assert eligible.payout_transaction_id == payout_transaction.id


class _FakeSpan:
    def __init__(self, name: str, attributes: dict[str, Any]) -> None:
        self.name = name
        self.attributes = attributes

    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value

    def set_attributes(self, values: dict[str, Any]) -> None:
        self.attributes.update(values)

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *args: object) -> None:
        return None


def _patch_spans(mocker: MockerFixture) -> list[_FakeSpan]:
    spans: list[_FakeSpan] = []

    def _span(name: str, **kwargs: Any) -> _FakeSpan:
        span = _FakeSpan(name, dict(kwargs))
        spans.append(span)
        return span

    mocker.patch("polar.transaction.repository.logfire.span", side_effect=_span)
    return spans


@pytest.mark.asyncio
class TestPayoutQueryOutcomes:
    async def test_success_outcome_on_spans(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        spans = _patch_spans(mocker)
        payout_transaction = await _create_payout_target(save_fixture, account)
        await create_balance_transaction(
            save_fixture, account=account, created_at=ten_days_ago
        )

        repository = TransactionRepository.from_session(session)
        await repository.set_unpaid_transactions_payout(
            account.id, payout_transaction.id
        )

        select_span = next(
            s for s in spans if s.name == "select_unpaid_transactions_for_update"
        )
        batch_span = next(s for s in spans if s.name == "update_payout_batch")
        assert select_span.attributes["outcome"] == "success"
        assert batch_span.attributes["outcome"] == "success"

    async def test_error_outcome_on_spans(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        account: Account,
        mocker: MockerFixture,
    ) -> None:
        spans = _patch_spans(mocker)
        payout_transaction = await _create_payout_target(save_fixture, account)
        await create_balance_transaction(
            save_fixture, account=account, created_at=ten_days_ago
        )

        original_execute = session.execute

        async def failing_execute(*args: Any, **kwargs: Any) -> Any:
            if args and isinstance(args[0], Update):
                raise RuntimeError("update failed")
            return await original_execute(*args, **kwargs)

        mocker.patch.object(session, "execute", side_effect=failing_execute)

        repository = TransactionRepository.from_session(session)
        with pytest.raises(RuntimeError, match="update failed"):
            await repository.set_unpaid_transactions_payout(
                account.id, payout_transaction.id
            )

        batch_span = next(s for s in spans if s.name == "update_payout_batch")
        assert batch_span.attributes["outcome"] == "error"
