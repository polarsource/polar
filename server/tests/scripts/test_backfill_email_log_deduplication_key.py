from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy import select

from polar.enums import EmailSender
from polar.kit.db.postgres import AsyncSession
from polar.models.email_log import EmailLog, EmailLogStatus
from scripts.backfill_email_log_deduplication_key import run_backfill
from tests.fixtures.database import SaveFixture


async def _create_email_log(
    save_fixture: SaveFixture,
    *,
    template: str,
    email_props: dict[str, Any],
    to_email_addr: str = "customer@example.com",
    status: EmailLogStatus = EmailLogStatus.sent,
    deduplication_key: str | None = None,
    created_at: datetime | None = None,
) -> EmailLog:
    email_log = EmailLog(
        status=status,
        processor=EmailSender.logger,
        to_email_addr=to_email_addr,
        from_email_addr="noreply@polar.sh",
        from_name="Polar",
        subject="Subject",
        email_template=template,
        email_props=email_props,
        deduplication_key=deduplication_key,
    )
    if created_at is not None:
        email_log.created_at = created_at
    await save_fixture(email_log)
    return email_log


async def _get_key(session: AsyncSession, email_log: EmailLog) -> str | None:
    result = await session.execute(
        select(EmailLog.deduplication_key).where(EmailLog.id == email_log.id)
    )
    return result.scalar_one()


def _card_props(payment_method_id: str) -> dict[str, Any]:
    return {
        "payment_method": {
            "id": payment_method_id,
            "method_metadata": {"exp_year": 2026, "exp_month": 4},
        }
    }


@pytest.mark.asyncio
class TestBackfillEmailLogDeduplicationKey:
    async def test_backfills_card_reminder(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        payment_method_id = str(uuid4())
        email_log = await _create_email_log(
            save_fixture,
            template="payment_method_expiration_reminder",
            email_props=_card_props(payment_method_id),
        )

        updated = await run_backfill(dry_run=False, session=session)

        assert updated == 1
        assert (
            await _get_key(session, email_log)
            == f"payment_method_expiration_reminder:{payment_method_id}:2026-4"
        )

    async def test_reconstructs_iso_date_for_subscription_reminders(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        subscription_id = str(uuid4())
        renewal = await _create_email_log(
            save_fixture,
            template="subscription_renewal_reminder",
            email_props={
                "subscription": {"id": subscription_id},
                "renewal_date": "November 7, 2026",
            },
        )
        trial = await _create_email_log(
            save_fixture,
            template="subscription_trial_conversion_reminder",
            email_props={
                "subscription": {"id": subscription_id},
                "conversion_date": "March 17, 2026",
            },
        )

        await run_backfill(dry_run=False, session=session)

        assert (
            await _get_key(session, renewal)
            == f"subscription_renewal_reminder:{subscription_id}:2026-11-07"
        )
        assert (
            await _get_key(session, trial)
            == f"subscription_trial_conversion_reminder:{subscription_id}:2026-03-17"
        )

    async def test_skips_failed_and_non_reminder_and_already_keyed(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        failed = await _create_email_log(
            save_fixture,
            template="payment_method_expiration_reminder",
            email_props=_card_props(str(uuid4())),
            status=EmailLogStatus.failed,
        )
        non_reminder = await _create_email_log(
            save_fixture,
            template="order_confirmation",
            email_props=_card_props(str(uuid4())),
        )
        already_keyed = await _create_email_log(
            save_fixture,
            template="payment_method_expiration_reminder",
            email_props=_card_props(str(uuid4())),
            deduplication_key="preexisting",
        )

        updated = await run_backfill(dry_run=False, session=session)

        assert updated == 0
        assert await _get_key(session, failed) is None
        assert await _get_key(session, non_reminder) is None
        assert await _get_key(session, already_keyed) == "preexisting"

    async def test_keys_one_row_per_key_and_recipient(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        payment_method_id = str(uuid4())
        earliest = await _create_email_log(
            save_fixture,
            template="payment_method_expiration_reminder",
            email_props=_card_props(payment_method_id),
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        duplicate = await _create_email_log(
            save_fixture,
            template="payment_method_expiration_reminder",
            email_props=_card_props(payment_method_id),
            created_at=datetime(2026, 1, 2, tzinfo=UTC),
        )
        other_recipient = await _create_email_log(
            save_fixture,
            template="payment_method_expiration_reminder",
            email_props=_card_props(payment_method_id),
            to_email_addr="another@example.com",
            created_at=datetime(2026, 1, 3, tzinfo=UTC),
        )

        await run_backfill(dry_run=False, session=session)

        expected = f"payment_method_expiration_reminder:{payment_method_id}:2026-4"
        assert await _get_key(session, earliest) == expected
        # Same (key, recipient) collision: the later duplicate stays NULL so the
        # PR2 unique index can build.
        assert await _get_key(session, duplicate) is None
        # Different recipient is a distinct index entry and gets keyed.
        assert await _get_key(session, other_recipient) == expected

    async def test_skips_group_already_keyed_by_a_newer_row(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        payment_method_id = str(uuid4())
        expected = f"payment_method_expiration_reminder:{payment_method_id}:2026-4"
        older_null = await _create_email_log(
            save_fixture,
            template="payment_method_expiration_reminder",
            email_props=_card_props(payment_method_id),
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        # A newer row (e.g. from the new send path) already holds the target key
        # for this recipient; backfilling the older row would collide.
        newer_keyed = await _create_email_log(
            save_fixture,
            template="payment_method_expiration_reminder",
            email_props=_card_props(payment_method_id),
            deduplication_key=expected,
            created_at=datetime(2026, 1, 2, tzinfo=UTC),
        )

        updated = await run_backfill(dry_run=False, session=session)

        assert updated == 0
        assert await _get_key(session, older_null) is None
        assert await _get_key(session, newer_keyed) == expected

    async def test_dry_run_is_the_default_and_writes_nothing(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        email_log = await _create_email_log(
            save_fixture,
            template="payment_method_expiration_reminder",
            email_props=_card_props(str(uuid4())),
        )

        would_update = await run_backfill(session=session)

        assert would_update == 1
        assert await _get_key(session, email_log) is None

    async def test_is_idempotent(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        email_log = await _create_email_log(
            save_fixture,
            template="payment_method_expiration_reminder",
            email_props=_card_props(str(uuid4())),
        )

        first = await run_backfill(dry_run=False, session=session)
        second = await run_backfill(dry_run=False, session=session)

        assert first == 1
        assert second == 0
        assert await _get_key(session, email_log) is not None
