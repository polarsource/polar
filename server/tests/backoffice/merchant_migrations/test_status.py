from datetime import timedelta

from polar.backoffice.merchant_migrations.status import (
    PAN_STEP_LABELS,
    AttentionLevel,
    attention,
    progress,
    step_inputs,
)
from polar.kit.utils import utc_now
from polar.merchant_migration import pan_transfer
from polar.merchant_migration.pan_transfer import (
    PanStepActor,
    PanStepOwner,
    PanTransferMethod,
    PanTransferStep,
    templates_for,
)
from polar.models import MerchantMigration
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.models.merchant_migration_record import (
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)

NO_FAILURES = 0


def _migration(
    *,
    step: MerchantMigrationStep = MerchantMigrationStep.source_setup,
    steps: list[PanTransferStep] | None = None,
    platform: MerchantMigrationSourcePlatform = MerchantMigrationSourcePlatform.stripe,
) -> MerchantMigration:
    migration = MerchantMigration(
        id=MerchantMigration.generate_id(),
        source_platform=platform,
        step=step,
    )
    migration.pan_transfer_steps = steps if steps is not None else []
    return migration


def _advance_to(key: str) -> list[PanTransferStep]:
    """Walk a fresh copy checklist up to `key`, so the step under test is current."""
    steps = pan_transfer.build(PanTransferMethod.pan_copy)
    while True:
        current = pan_transfer.current(steps)
        assert current is not None
        if current.key == key:
            return steps
        actor = (
            PanStepActor.system
            if current.owner == PanStepOwner.polar_app
            else PanStepActor.ops
        )
        template = pan_transfer._template(PanTransferMethod.pan_copy, current.key)
        steps = pan_transfer.complete(
            PanTransferMethod.pan_copy,
            steps,
            current.key,
            actor=actor,
            inputs={key: "value" for key in template.required_inputs},
        )


class TestAttention:
    def test_failed_records_need_ops_before_anything_else(self) -> None:
        migration = _migration(
            step=MerchantMigrationStep.completed, steps=_advance_to("start_copy")
        )
        result = attention(migration, 1)

        assert result.level == AttentionLevel.ops_action
        assert result.needs_ops
        assert "1 record(s) failed" in result.detail

    def test_ops_owned_current_step_needs_ops(self) -> None:
        migration = _migration(
            step=MerchantMigrationStep.copy_cards, steps=_advance_to("authorize_copy")
        )

        result = attention(migration, NO_FAILURES)

        assert result.level == AttentionLevel.ops_action
        assert result.label == "Ops action"

    def test_unexplained_third_party_wait_needs_an_eta(self) -> None:
        migration = _migration(
            step=MerchantMigrationStep.copy_cards, steps=_advance_to("stripe_copy")
        )

        result = attention(migration, NO_FAILURES)

        assert result.level == AttentionLevel.ops_followup
        assert result.label == "No ETA"
        assert result.needs_ops

    def test_annotated_third_party_wait_stops_asking_for_an_eta(self) -> None:
        steps = pan_transfer.annotate(
            _advance_to("stripe_copy"),
            "stripe_copy",
            note="Stripe confirmed, landing this week.",
        )
        migration = _migration(step=MerchantMigrationStep.copy_cards, steps=steps)

        result = attention(migration, NO_FAILURES)

        assert result.level == AttentionLevel.waiting_third_party
        assert not result.needs_ops

    def test_merchant_owned_current_step_waits_on_the_merchant(self) -> None:
        migration = _migration(
            step=MerchantMigrationStep.copy_cards, steps=_advance_to("start_copy")
        )

        result = attention(migration, NO_FAILURES)

        assert result.level == AttentionLevel.waiting_merchant
        assert not result.needs_ops

    def test_polar_app_step_is_a_polar_job(self) -> None:
        migration = _migration(
            step=MerchantMigrationStep.copy_cards, steps=_advance_to("verify_cards")
        )

        result = attention(migration, NO_FAILURES)

        assert result.level == AttentionLevel.waiting_polar_app

    def test_pre_card_steps_wait_on_the_merchant(self) -> None:
        migration = _migration(step=MerchantMigrationStep.pre_check)

        result = attention(migration, NO_FAILURES)

        assert result.level == AttentionLevel.waiting_merchant

    def test_completed_migration_is_done(self) -> None:
        migration = _migration(step=MerchantMigrationStep.completed)

        result = attention(migration, NO_FAILURES)

        assert result.level == AttentionLevel.done

    def test_finished_checklist_on_an_open_migration_needs_closing_out(self) -> None:
        steps = pan_transfer.build(PanTransferMethod.pan_copy)
        while pan_transfer.current(steps) is not None:
            current = pan_transfer.current(steps)
            assert current is not None
            actor = (
                PanStepActor.system
                if current.owner == PanStepOwner.polar_app
                else PanStepActor.ops
            )
            template = pan_transfer._template(PanTransferMethod.pan_copy, current.key)
            steps = pan_transfer.complete(
                PanTransferMethod.pan_copy,
                steps,
                current.key,
                actor=actor,
                inputs={key: "value" for key in template.required_inputs},
            )
        migration = _migration(step=MerchantMigrationStep.copy_cards, steps=steps)

        result = attention(migration, NO_FAILURES)

        assert result.level == AttentionLevel.ops_action
        assert "close the migration out" in result.detail


class TestStaleness:
    def test_step_open_longer_than_the_threshold_is_flagged(self) -> None:
        steps = _advance_to("start_copy")
        steps[1].started_at = utc_now() - timedelta(days=10)
        migration = _migration(step=MerchantMigrationStep.copy_cards, steps=steps)

        result = attention(migration, NO_FAILURES)

        assert result.stale_days == 10

    def test_an_overdue_step_lands_in_the_ops_queue(self) -> None:
        """Even a merchant-owned step: someone has to nudge them."""
        steps = _advance_to("start_copy")
        steps[1].started_at = utc_now() - timedelta(days=10)
        migration = _migration(step=MerchantMigrationStep.copy_cards, steps=steps)

        result = attention(migration, NO_FAILURES)

        assert result.level == AttentionLevel.waiting_merchant
        assert result.needs_ops

    def test_a_fresh_step_is_not_flagged(self) -> None:
        migration = _migration(
            step=MerchantMigrationStep.copy_cards, steps=_advance_to("start_copy")
        )

        assert attention(migration, NO_FAILURES).stale_days is None

    def test_an_eta_in_the_past_wins_over_the_threshold(self) -> None:
        steps = pan_transfer.annotate(
            _advance_to("stripe_copy"),
            "stripe_copy",
            expected_at=utc_now() - timedelta(days=2),
        )
        migration = _migration(step=MerchantMigrationStep.copy_cards, steps=steps)

        assert attention(migration, NO_FAILURES).stale_days == 2

    def test_an_eta_is_not_overdue_on_the_day_itself(self) -> None:
        """The ETA is a calendar date: it only bites once the day has passed."""
        steps = pan_transfer.annotate(
            _advance_to("stripe_copy"), "stripe_copy", expected_at=utc_now()
        )
        migration = _migration(step=MerchantMigrationStep.copy_cards, steps=steps)

        assert attention(migration, NO_FAILURES).stale_days is None

    def test_no_movement_still_counts_when_an_eta_is_set(self) -> None:
        """An ETA in the future must not mask a step nobody has touched."""
        steps = pan_transfer.annotate(
            _advance_to("stripe_copy"),
            "stripe_copy",
            expected_at=utc_now() + timedelta(days=30),
        )
        steps[3].started_at = utc_now() - timedelta(days=20)
        migration = _migration(step=MerchantMigrationStep.copy_cards, steps=steps)

        assert attention(migration, NO_FAILURES).stale_days == 20

    def test_an_eta_in_the_future_is_not_overdue(self) -> None:
        steps = pan_transfer.annotate(
            _advance_to("stripe_copy"),
            "stripe_copy",
            expected_at=utc_now() + timedelta(days=5),
        )
        migration = _migration(step=MerchantMigrationStep.copy_cards, steps=steps)

        assert attention(migration, NO_FAILURES).stale_days is None


class TestProgress:
    def test_tallies_every_type_together(self) -> None:
        migration_id = MerchantMigration.generate_id()
        counts = {
            (
                migration_id,
                MerchantMigrationRecordType.customer,
                MerchantMigrationRecordStatus.imported,
            ): 4,
            (
                migration_id,
                MerchantMigrationRecordType.product,
                MerchantMigrationRecordStatus.pending,
            ): 2,
            (
                migration_id,
                MerchantMigrationRecordType.subscription,
                MerchantMigrationRecordStatus.failed,
            ): 1,
        }

        result = progress(counts, migration_id)

        assert result.total == 7
        assert result.imported == 4
        assert result.pending == 2
        assert result.failed == 1


class TestStepInputs:
    def test_returns_the_engine_inputs_with_their_requiredness(self) -> None:
        migration = _migration(platform=MerchantMigrationSourcePlatform.paddle)

        assert step_inputs(migration, "request_provider_export") == [
            ("provider_reference", True),
            ("provider_contact", False),
        ]

    def test_unknown_step_has_no_inputs(self) -> None:
        assert step_inputs(_migration(), "not_a_step") == []


class TestCopyCoverage:
    def test_every_template_key_has_an_ops_label(self) -> None:
        """A new engine step must not surface in the queue as a raw key."""
        keys = {
            template.key
            for method in PanTransferMethod
            for template in templates_for(method)
        }

        assert keys <= set(PAN_STEP_LABELS)
