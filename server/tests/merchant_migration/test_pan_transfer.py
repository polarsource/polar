import pytest

from polar.exceptions import PolarRequestValidationError
from polar.merchant_migration import pan_transfer
from polar.merchant_migration.pan_transfer import (
    PanStepActor,
    PanStepKind,
    PanStepNotActionable,
    PanStepNotFound,
    PanStepNotOwned,
    PanStepOwner,
    PanStepStatus,
    PanTransferMethod,
    PanTransferStep,
    PanTransferStepsType,
)
from polar.models import MerchantMigration
from polar.models.merchant_migration import MerchantMigrationSourcePlatform
from tests.merchant_migration._helpers import pan_step_required_inputs


def _copy_steps() -> list[PanTransferStep]:
    return pan_transfer.build(PanTransferMethod.pan_copy)


def _advance_to(
    steps: list[PanTransferStep],
    key: str,
    *,
    method: PanTransferMethod = PanTransferMethod.pan_copy,
) -> list[PanTransferStep]:
    """Complete every step ahead of `key` as whoever owns it. Ops stands in for
    everyone but the app, which is what `_ACTOR_OWNERS` allows."""
    while True:
        step = pan_transfer.current(steps)
        assert step is not None
        if step.key == key:
            return steps
        actor = (
            PanStepActor.system
            if step.owner == PanStepOwner.polar_app
            else PanStepActor.ops
        )
        template = pan_transfer._template(method, step.key)
        steps = pan_transfer.complete(
            method,
            steps,
            step.key,
            actor=actor,
            inputs=pan_step_required_inputs(template),
        )


class TestPanTransferMethod:
    def test_stripe_source_copies(self) -> None:
        migration = MerchantMigration(
            source_platform=MerchantMigrationSourcePlatform.stripe
        )
        assert migration.pan_transfer_method == PanTransferMethod.pan_copy

    @pytest.mark.parametrize(
        "platform",
        [
            MerchantMigrationSourcePlatform.paddle,
            MerchantMigrationSourcePlatform.lemon_squeezy,
        ],
    )
    def test_other_vaults_import(
        self, platform: MerchantMigrationSourcePlatform
    ) -> None:
        migration = MerchantMigration(source_platform=platform)
        assert migration.pan_transfer_method == PanTransferMethod.pan_import


class TestBuild:
    def test_only_one_step_is_actionable(self) -> None:
        steps = _copy_steps()
        actionable = [
            step
            for step in steps
            if step.status in (PanStepStatus.pending, PanStepStatus.in_progress)
        ]
        assert len(actionable) == 1

    def test_information_only_steps_complete_immediately(self) -> None:
        steps = _copy_steps()

        # Sharing Polar's destination account has nothing to wait on, so the
        # merchant lands straight on the step they have to act on.
        assert steps[0].key == "share_destination_account"
        assert steps[0].status == PanStepStatus.completed
        assert steps[0].completed_by == PanStepActor.system
        current = pan_transfer.current(steps)
        assert current is not None
        assert current.key == "start_copy"

    def test_remaining_steps_are_blocked(self) -> None:
        steps = _copy_steps()
        assert [step.status for step in steps[2:]] == [PanStepStatus.blocked] * (
            len(steps) - 2
        )

    def test_import_starts_with_ops(self) -> None:
        steps = pan_transfer.build(PanTransferMethod.pan_import)
        current = pan_transfer.current(steps)
        assert current is not None
        assert current.key == "open_stripe_request"
        assert current.owner == PanStepOwner.polar_ops

    @pytest.mark.parametrize("method", list(PanTransferMethod))
    def test_keys_are_unique(self, method: PanTransferMethod) -> None:
        # Steps are addressed by key everywhere: the API path, the client copy,
        # and the lookups here.
        keys = [template.key for template in pan_transfer.templates_for(method)]
        assert len(keys) == len(set(keys))

    @pytest.mark.parametrize("method", list(PanTransferMethod))
    def test_every_method_ends_on_the_merchant_then_us(
        self, method: PanTransferMethod
    ) -> None:
        templates = pan_transfer.templates_for(method)
        assert templates[-1].key == "move_subscriptions"
        assert templates[-1].owner == PanStepOwner.polar_app
        # Cutover is the last thing the merchant does before we take over billing.
        assert templates[-2].key == "cutover"
        assert templates[-2].owner == PanStepOwner.merchant


class TestComplete:
    def test_unblocks_the_next_step(self) -> None:
        steps = pan_transfer.complete(
            PanTransferMethod.pan_copy,
            _copy_steps(),
            "start_copy",
            actor=PanStepActor.merchant,
            inputs={"stripe_migration_request_id": "migreq_123"},
        )

        assert steps[1].status == PanStepStatus.completed
        assert steps[1].completed_at is not None
        assert steps[1].completed_by == PanStepActor.merchant
        current = pan_transfer.current(steps)
        assert current is not None
        assert current.key == "authorize_copy"
        assert current.started_at is not None

    def test_stores_required_inputs(self) -> None:
        steps = pan_transfer.complete(
            PanTransferMethod.pan_copy,
            _copy_steps(),
            "start_copy",
            actor=PanStepActor.merchant,
            inputs={"stripe_migration_request_id": " migreq_123 "},
        )

        assert steps[1].inputs == {"stripe_migration_request_id": "migreq_123"}

    def test_rejects_a_step_that_is_not_current(self) -> None:
        with pytest.raises(PanStepNotActionable):
            pan_transfer.complete(
                PanTransferMethod.pan_copy,
                _copy_steps(),
                "cutover",
                actor=PanStepActor.merchant,
                inputs={},
            )

    def test_rejects_completing_twice(self) -> None:
        steps = pan_transfer.complete(
            PanTransferMethod.pan_copy,
            _copy_steps(),
            "start_copy",
            actor=PanStepActor.merchant,
            inputs={"stripe_migration_request_id": "migreq_123"},
        )

        with pytest.raises(PanStepNotActionable):
            pan_transfer.complete(
                PanTransferMethod.pan_copy,
                steps,
                "start_copy",
                actor=PanStepActor.merchant,
                inputs={},
            )

    def test_rejects_an_unknown_step(self) -> None:
        with pytest.raises(PanStepNotFound):
            pan_transfer.complete(
                PanTransferMethod.pan_copy,
                _copy_steps(),
                "nope",
                actor=PanStepActor.merchant,
                inputs={},
            )

    def test_merchant_cannot_complete_an_ops_step(self) -> None:
        steps = _advance_to(_copy_steps(), "authorize_copy")

        with pytest.raises(PanStepNotOwned):
            pan_transfer.complete(
                PanTransferMethod.pan_copy,
                steps,
                "authorize_copy",
                actor=PanStepActor.merchant,
                inputs={},
            )

    def test_ops_can_complete_a_merchant_step(self) -> None:
        steps = pan_transfer.complete(
            PanTransferMethod.pan_copy,
            _copy_steps(),
            "start_copy",
            actor=PanStepActor.ops,
            inputs={"stripe_migration_request_id": "migreq_123"},
        )

        assert steps[1].completed_by == PanStepActor.ops

    def test_ops_cannot_stand_in_for_the_app(self) -> None:
        steps = _advance_to(_copy_steps(), "verify_cards")

        # Completing this would skip linking the copied cards, not perform it.
        with pytest.raises(PanStepNotOwned):
            pan_transfer.complete(
                PanTransferMethod.pan_copy,
                steps,
                "verify_cards",
                actor=PanStepActor.ops,
                inputs={},
            )

    def test_requires_declared_inputs(self) -> None:
        steps = pan_transfer.build(PanTransferMethod.pan_import)

        with pytest.raises(PolarRequestValidationError) as exc:
            pan_transfer.complete(
                PanTransferMethod.pan_import,
                steps,
                "open_stripe_request",
                actor=PanStepActor.ops,
                inputs={"stripe_migration_request_id": "   "},
            )
        errors = exc.value.errors()
        assert [error["type"] for error in errors] == ["missing"]
        assert errors[0]["loc"] == ("body", "inputs", "stripe_migration_request_id")

    def test_copy_requires_stripe_migration_id(self) -> None:
        with pytest.raises(PolarRequestValidationError) as exc:
            pan_transfer.complete(
                PanTransferMethod.pan_copy,
                _copy_steps(),
                "start_copy",
                actor=PanStepActor.merchant,
                inputs={},
            )

        errors = exc.value.errors()
        assert [error["type"] for error in errors] == ["missing"]
        assert errors[0]["loc"] == ("body", "inputs", "stripe_migration_request_id")

    @pytest.mark.parametrize(
        ("method", "key", "actor"),
        (
            (
                PanTransferMethod.pan_copy,
                "start_copy",
                PanStepActor.merchant,
            ),
            (
                PanTransferMethod.pan_import,
                "open_stripe_request",
                PanStepActor.ops,
            ),
        ),
    )
    def test_rejects_invalid_stripe_migration_id(
        self,
        method: PanTransferMethod,
        key: str,
        actor: PanStepActor,
    ) -> None:
        steps = pan_transfer.build(method)
        with pytest.raises(PolarRequestValidationError) as exc:
            pan_transfer.complete(
                method,
                steps,
                key,
                actor=actor,
                inputs={"stripe_migration_request_id": "mig_123"},
            )

        errors = exc.value.errors()
        assert [error["type"] for error in errors] == ["string_pattern_mismatch"]
        assert errors[0]["loc"] == ("body", "inputs", "stripe_migration_request_id")

    def test_rejects_undeclared_inputs(self) -> None:
        with pytest.raises(PolarRequestValidationError) as exc:
            pan_transfer.complete(
                PanTransferMethod.pan_copy,
                _copy_steps(),
                "start_copy",
                actor=PanStepActor.merchant,
                inputs={
                    "stripe_migration_request_id": "migreq_123",
                    "whatever": "x",
                },
            )
        errors = exc.value.errors()
        assert [error["type"] for error in errors] == ["extra_forbidden"]
        assert errors[0]["loc"] == ("body", "inputs", "whatever")

    def test_walks_the_whole_checklist(self) -> None:
        steps = _advance_to(_copy_steps(), "move_subscriptions")
        steps = pan_transfer.complete(
            PanTransferMethod.pan_copy,
            steps,
            "move_subscriptions",
            actor=PanStepActor.system,
            inputs={},
        )

        assert pan_transfer.current(steps) is None
        assert all(step.status == PanStepStatus.completed for step in steps)


class TestAnnotate:
    def test_explains_a_step_we_are_waiting_on(self) -> None:
        steps = _advance_to(_copy_steps(), "stripe_copy")
        steps = pan_transfer.annotate(
            steps, "stripe_copy", note="Stripe is copying.", in_progress=True
        )

        step = pan_transfer.current(steps)
        assert step is not None
        assert step.key == "stripe_copy"
        assert step.status == PanStepStatus.in_progress
        assert step.note == "Stripe is copying."

    def test_an_in_progress_step_stays_current(self) -> None:
        steps = pan_transfer.annotate(
            _advance_to(_copy_steps(), "stripe_copy"), "stripe_copy", in_progress=True
        )
        steps = pan_transfer.complete(
            PanTransferMethod.pan_copy,
            steps,
            "stripe_copy",
            actor=PanStepActor.ops,
            inputs={},
        )

        current = pan_transfer.current(steps)
        assert current is not None
        assert current.key == "verify_cards"

    def test_can_annotate_a_step_that_is_still_blocked(self) -> None:
        steps = pan_transfer.annotate(_copy_steps(), "cutover", note="Not yet.")

        assert steps[-2].note == "Not yet."
        assert steps[-2].status == PanStepStatus.blocked

    def test_rejects_a_completed_step(self) -> None:
        with pytest.raises(PanStepNotActionable):
            pan_transfer.annotate(_copy_steps(), "share_destination_account", note="x")

    def test_only_the_current_step_can_be_in_progress(self) -> None:
        with pytest.raises(PanStepNotActionable):
            pan_transfer.annotate(_copy_steps(), "cutover", in_progress=True)


class TestPanTransferStepsType:
    def test_round_trips_through_the_column(self) -> None:
        steps = pan_transfer.complete(
            PanTransferMethod.pan_copy,
            _copy_steps(),
            "start_copy",
            actor=PanStepActor.merchant,
            inputs={"stripe_migration_request_id": "migreq_123"},
        )
        column = PanTransferStepsType()

        stored = column.process_bind_param(steps, None)  # type: ignore[arg-type]
        assert isinstance(stored[0], dict)
        assert column.process_result_value(stored, None) == steps  # type: ignore[arg-type]

    def test_passes_none_through(self) -> None:
        column = PanTransferStepsType()

        assert column.process_bind_param(None, None) is None  # type: ignore[arg-type]
        assert column.process_result_value(None, None) is None  # type: ignore[arg-type]


class TestKinds:
    @pytest.mark.parametrize("method", list(PanTransferMethod))
    def test_only_polar_and_third_parties_own_auto_steps(
        self, method: PanTransferMethod
    ) -> None:
        # A step the merchant owns always has something to click, otherwise the
        # checklist would stall waiting on them with no action to take.
        for template in pan_transfer.templates_for(method):
            if template.kind == PanStepKind.auto:
                assert template.owner != PanStepOwner.merchant
