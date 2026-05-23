"""Tests for OrganizationReviewSignalHistoryRepository + service helpers."""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from polar.models.organization import Organization
from polar.models.organization_review_signal_history import SignalResolution
from polar.models.user import User
from polar.organization_review_agent.schemas import (
    RaisedSignal,
    Severity,
    SignalKind,
)
from polar.organization_review_agent.service import (
    organization_review_agent_service,
)
from polar.organization_review_agent.signal_history_repository import (
    OrganizationReviewSignalHistoryRepository,
)
from polar.postgres import AsyncSession


@pytest.mark.asyncio
class TestPersistSignalsFromRun:
    async def test_creates_pending_rows(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )

        repository = OrganizationReviewSignalHistoryRepository.from_session(
            session
        )
        rows = await repository.persist_signals_from_run(
            organization_id=organization.id,
            agent_run_id=run.id,
            signals=[
                RaisedSignal(
                    kind=SignalKind.PRIOR_DENIALS_PRESENT,
                    severity=Severity.MEDIUM,
                    summary="2 denials",
                    evidence={"slugs": ["foo", "bar"]},
                ),
                RaisedSignal(
                    kind=SignalKind.USER_BLOCKED,
                    severity=Severity.HIGH,
                    summary="admin blocked",
                ),
            ],
        )

        assert len(rows) == 2
        assert all(
            r.resolution == SignalResolution.PENDING for r in rows
        )
        assert all(r.agent_run_id == run.id for r in rows)

    async def test_uses_registry_default_when_severity_omitted(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )

        repository = OrganizationReviewSignalHistoryRepository.from_session(
            session
        )
        rows = await repository.persist_signals_from_run(
            organization_id=organization.id,
            agent_run_id=run.id,
            signals=[
                RaisedSignal(
                    kind=SignalKind.USER_BLOCKED,
                    summary="x",
                )  # no explicit severity
            ],
        )
        # USER_BLOCKED default severity is HIGH per taxonomy.
        assert rows[0].severity == "high"


@pytest.mark.asyncio
class TestResolveSignal:
    async def _seed(
        self, session: AsyncSession, organization: Organization
    ):
        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )
        repository = OrganizationReviewSignalHistoryRepository.from_session(
            session
        )
        rows = await repository.persist_signals_from_run(
            organization_id=organization.id,
            agent_run_id=run.id,
            signals=[
                RaisedSignal(
                    kind=SignalKind.PRIOR_DENIALS_PRESENT,
                    severity=Severity.MEDIUM,
                    summary="2 denials",
                )
            ],
        )
        return rows[0]

    async def test_flips_pending_to_approved(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        row = await self._seed(session, organization)
        await organization_review_agent_service.resolve_signal(
            session,
            row,
            resolution=SignalResolution.APPROVED,
            reviewer_reason="confirmed manually with payouts team",
            reviewer_user_id=user.id,
        )
        assert row.resolution == SignalResolution.APPROVED
        assert row.reviewer_reason == "confirmed manually with payouts team"
        assert row.reviewed_by_user_id == user.id
        assert row.reviewed_at is not None

    async def test_rejects_short_reason(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        row = await self._seed(session, organization)
        # ValueError raised before FK check, so uuid4() is fine here.
        with pytest.raises(ValueError, match="≥3 chars"):
            await organization_review_agent_service.resolve_signal(
                session,
                row,
                resolution=SignalResolution.APPROVED,
                reviewer_reason="ok",
                reviewer_user_id=uuid4(),
            )

    async def test_rejects_setting_back_to_pending(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        row = await self._seed(session, organization)
        with pytest.raises(ValueError, match="PENDING"):
            await organization_review_agent_service.resolve_signal(
                session,
                row,
                resolution=SignalResolution.PENDING,
                reviewer_reason="undo",
                reviewer_user_id=uuid4(),
            )


@pytest.mark.asyncio
class TestRetireSignal:
    async def test_retire_marks_row_and_appends_to_reason(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )
        repository = OrganizationReviewSignalHistoryRepository.from_session(
            session
        )
        rows = await repository.persist_signals_from_run(
            organization_id=organization.id,
            agent_run_id=run.id,
            signals=[
                RaisedSignal(
                    kind=SignalKind.PRIOR_DENIALS_PRESENT,
                    severity=Severity.MEDIUM,
                    summary="2 denials",
                )
            ],
        )
        row = rows[0]

        await organization_review_agent_service.resolve_signal(
            session,
            row,
            resolution=SignalResolution.APPROVED,
            reviewer_reason="confirmed by payouts",
            reviewer_user_id=user.id,
        )

        await organization_review_agent_service.retire_signal(
            session,
            row,
            reviewer_user_id=user.id,
            reason="merchant changed business model",
        )

        assert row.retired_at is not None
        assert "retired: merchant changed business model" in (
            row.reviewer_reason or ""
        )

    async def test_retire_is_idempotent(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )
        repository = OrganizationReviewSignalHistoryRepository.from_session(
            session
        )
        rows = await repository.persist_signals_from_run(
            organization_id=organization.id,
            agent_run_id=run.id,
            signals=[
                RaisedSignal(
                    kind=SignalKind.PRIOR_DENIALS_PRESENT,
                    severity=Severity.MEDIUM,
                    summary="2 denials",
                )
            ],
        )
        row = rows[0]
        await organization_review_agent_service.retire_signal(
            session, row, reviewer_user_id=user.id, reason="first"
        )
        first_retired = row.retired_at
        await organization_review_agent_service.retire_signal(
            session, row, reviewer_user_id=user.id, reason="second"
        )
        assert row.retired_at == first_retired
        assert "second" not in (row.reviewer_reason or "")


@pytest.mark.asyncio
class TestMemorySummary:
    async def test_aggregates_per_kind(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )
        repository = OrganizationReviewSignalHistoryRepository.from_session(
            session
        )
        rows = await repository.persist_signals_from_run(
            organization_id=organization.id,
            agent_run_id=run.id,
            signals=[
                RaisedSignal(
                    kind=SignalKind.PRIOR_DENIALS_PRESENT,
                    severity=Severity.MEDIUM,
                    summary="a",
                ),
                RaisedSignal(
                    kind=SignalKind.PRIOR_DENIALS_PRESENT,
                    severity=Severity.MEDIUM,
                    summary="b",
                ),
                RaisedSignal(
                    kind=SignalKind.USER_BLOCKED,
                    severity=Severity.HIGH,
                    summary="c",
                ),
            ],
        )
        await organization_review_agent_service.resolve_signal(
            session,
            rows[0],
            resolution=SignalResolution.APPROVED,
            reviewer_reason="confirmed",
            reviewer_user_id=user.id,
        )
        await organization_review_agent_service.resolve_signal(
            session,
            rows[1],
            resolution=SignalResolution.DISCARDED,
            reviewer_reason="false positive — appeals already won",
            reviewer_user_id=user.id,
        )
        await organization_review_agent_service.resolve_signal(
            session,
            rows[2],
            resolution=SignalResolution.APPROVED,
            reviewer_reason="confirmed via payouts ticket",
            reviewer_user_id=user.id,
        )

        summary = await organization_review_agent_service.get_signal_memory_for_organization(
            session, organization.id
        )
        assert summary == {
            "prior_denials_present": {"approved": 1, "discarded": 1},
            "user_blocked": {"approved": 1, "discarded": 0},
        }

    async def test_retired_rows_excluded(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )
        repository = OrganizationReviewSignalHistoryRepository.from_session(
            session
        )
        rows = await repository.persist_signals_from_run(
            organization_id=organization.id,
            agent_run_id=run.id,
            signals=[
                RaisedSignal(
                    kind=SignalKind.PRIOR_DENIALS_PRESENT,
                    severity=Severity.MEDIUM,
                    summary="x",
                )
            ],
        )
        await organization_review_agent_service.resolve_signal(
            session,
            rows[0],
            resolution=SignalResolution.APPROVED,
            reviewer_reason="confirmed",
            reviewer_user_id=user.id,
        )
        await organization_review_agent_service.retire_signal(
            session,
            rows[0],
            reviewer_user_id=user.id,
            reason="org changed",
        )

        summary = await organization_review_agent_service.get_signal_memory_for_organization(
            session, organization.id
        )
        assert summary == {}
