"""The PAN transfer checklist: moving saved cards onto Polar's Stripe account.

Moving cards takes days (Stripe to Stripe) or weeks (any other vault), and the work
is split between the merchant, Polar Ops, Polar itself, Stripe, and the source
provider. So it's tracked as an ordered checklist: exactly one step is actionable
at a time, and completing it unblocks the next.

This module is the engine: the step templates, the persisted step state, and the
transitions. It holds no copy — titles and guidance live in the frontend, keyed by
`key`, so wording can change without a data migration.

Kept free of `polar.models` imports so the model layer can use `PanTransferStep`
as its column type.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import Field
from sqlalchemy import Dialect
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator

from polar.exceptions import PolarRequestValidationError, ValidationError
from polar.kit.schemas import Schema
from polar.kit.utils import utc_now

from .errors import MerchantMigrationError


class PanTransferMethod(StrEnum):
    """How the cards reach Polar's Stripe account."""

    # Stripe to Stripe. Self-serve in the Stripe Dashboard, hours to 72h.
    pan_copy = "pan_copy"
    # Any other vault to Stripe. Coordinated with Stripe and the provider, weeks.
    pan_import = "pan_import"


class PanStepOwner(StrEnum):
    """Who moves a step forward."""

    merchant = "merchant"
    polar_ops = "polar_ops"
    polar_app = "polar_app"
    stripe = "stripe"
    provider = "provider"


class PanStepKind(StrEnum):
    """What the owner has to do, which is what the frontend renders."""

    # Nothing to click: Polar, Stripe or the provider is working.
    auto = "auto"
    # Fill in values we need before the next step can run.
    input = "input"
    # Acknowledge that something done elsewhere is finished.
    confirm = "confirm"


class PanStepStatus(StrEnum):
    blocked = "blocked"
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"


class PanStepActor(StrEnum):
    """Who is asking to move a step, which decides what they're allowed to move."""

    merchant = "merchant"
    ops = "ops"
    system = "system"


# Ops can unblock a merchant who is stuck, but never stands in for `polar_app`:
# those steps have side effects (creating payment methods, moving subscriptions)
# that completing the step would skip rather than perform.
_ACTOR_OWNERS: dict[PanStepActor, frozenset[PanStepOwner]] = {
    PanStepActor.merchant: frozenset({PanStepOwner.merchant}),
    PanStepActor.ops: frozenset(
        {
            PanStepOwner.merchant,
            PanStepOwner.polar_ops,
            PanStepOwner.stripe,
            PanStepOwner.provider,
        }
    ),
    PanStepActor.system: frozenset({PanStepOwner.polar_app}),
}

_ACTIONABLE = (PanStepStatus.pending, PanStepStatus.in_progress)

STEP_VERIFY_CARDS = "verify_cards"
STEP_RESOLVE_UNCOVERED = "resolve_uncovered"
STEP_CUTOVER = "cutover"
STEP_MOVE_SUBSCRIPTIONS = "move_subscriptions"


class PanTransferError(MerchantMigrationError): ...


class PanTransferNotStarted(PanTransferError):
    def __init__(self) -> None:
        super().__init__("The card transfer hasn't started yet.", 409)


class PanTransferAlreadyStarted(PanTransferError):
    def __init__(self) -> None:
        super().__init__("The card transfer has already started.", 409)


class PanTransferNotReady(PanTransferError):
    def __init__(self) -> None:
        super().__init__("Import the catalog before starting the card transfer.", 409)


class PanTransferUnavailable(PanTransferError):
    def __init__(self) -> None:
        super().__init__(
            "Card transfers aren't configured on this environment yet.", 409
        )


class PanStepNotFound(PanTransferError):
    def __init__(self, key: str) -> None:
        super().__init__(f"There is no `{key}` step in this card transfer.", 404)


class PanStepNotActionable(PanTransferError):
    def __init__(self, key: str) -> None:
        super().__init__(f"The `{key}` step isn't the one to act on right now.", 409)


class PanStepNotOwned(PanTransferError):
    def __init__(self, key: str, owner: PanStepOwner) -> None:
        super().__init__(f"The `{key}` step is completed by {owner.value}.", 403)


@dataclass(frozen=True)
class PanStepTemplate:
    key: str
    owner: PanStepOwner
    kind: PanStepKind
    required_inputs: tuple[str, ...] = ()
    optional_inputs: tuple[str, ...] = ()
    # Steps that only surface information Polar already holds. They complete the
    # moment they become current, so the merchant never waits on a no-op.
    auto_complete: bool = False

    @property
    def accepted_inputs(self) -> frozenset[str]:
        return frozenset(self.required_inputs) | frozenset(self.optional_inputs)


class PanTransferStep(Schema):
    """One checklist step, as persisted on `MerchantMigration.pan_transfer_steps`.

    The row is self-contained: owner and kind are copied off the template so both
    the stored JSONB and the API response can be read without resolving a
    template. The template stays authoritative for the rules that gate a
    transition (`auto_complete`, the accepted inputs), so a step whose key no
    longer has a template can't be completed.
    """

    key: str = Field(description="Stable identifier. The client keys its copy off it.")
    owner: PanStepOwner = Field(description="Who moves this step forward.")
    kind: PanStepKind = Field(
        description="What the owner does, so the client knows what to render."
    )
    status: PanStepStatus = Field(
        description="Where the step is. Only one step is actionable at a time."
    )
    inputs: dict[str, str] = Field(description="Values collected on this step.")
    note: str | None = Field(
        description=(
            "Free text from Polar Ops, shown to the merchant. How a weeks-long "
            "wait on Stripe or the provider gets explained without a support thread."
        )
    )
    expected_at: datetime | None = Field(
        description="When Ops expects this step to land."
    )
    started_at: datetime | None = Field(description="When the step became actionable.")
    completed_at: datetime | None = Field(description="When the step was completed.")
    completed_by: PanStepActor | None = Field(description="Who completed the step.")


class PanTransferStepsType(TypeDecorator[Any]):
    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return value
        return [
            step.model_dump(mode="json") if isinstance(step, PanTransferStep) else step
            for step in value
        ]

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return value
        return [PanTransferStep.model_validate(step) for step in value]


# Stripe to Stripe. See Appendix B of the merchant-migrations design doc.
PAN_COPY_TEMPLATES: tuple[PanStepTemplate, ...] = (
    PanStepTemplate(
        key="share_destination_account",
        owner=PanStepOwner.polar_app,
        kind=PanStepKind.auto,
        auto_complete=True,
    ),
    PanStepTemplate(
        key="start_copy",
        owner=PanStepOwner.merchant,
        kind=PanStepKind.confirm,
        optional_inputs=("stripe_migration_request_id",),
    ),
    PanStepTemplate(
        key="authorize_copy",
        owner=PanStepOwner.polar_ops,
        kind=PanStepKind.confirm,
    ),
    PanStepTemplate(
        key="stripe_copy",
        owner=PanStepOwner.stripe,
        kind=PanStepKind.auto,
    ),
    PanStepTemplate(
        key=STEP_VERIFY_CARDS,
        owner=PanStepOwner.polar_app,
        kind=PanStepKind.auto,
    ),
    PanStepTemplate(
        key=STEP_RESOLVE_UNCOVERED,
        owner=PanStepOwner.merchant,
        kind=PanStepKind.confirm,
    ),
    PanStepTemplate(
        key=STEP_CUTOVER,
        owner=PanStepOwner.merchant,
        kind=PanStepKind.confirm,
    ),
    PanStepTemplate(
        key=STEP_MOVE_SUBSCRIPTIONS,
        owner=PanStepOwner.polar_app,
        kind=PanStepKind.auto,
    ),
)

# Any other vault to Stripe.
PAN_IMPORT_TEMPLATES: tuple[PanStepTemplate, ...] = (
    PanStepTemplate(
        key="open_stripe_request",
        owner=PanStepOwner.polar_ops,
        kind=PanStepKind.input,
        required_inputs=("stripe_migration_request_id",),
    ),
    PanStepTemplate(
        key="request_provider_export",
        owner=PanStepOwner.merchant,
        kind=PanStepKind.input,
        required_inputs=("provider_reference",),
        optional_inputs=("provider_contact",),
    ),
    PanStepTemplate(
        key="provider_export",
        owner=PanStepOwner.provider,
        kind=PanStepKind.auto,
    ),
    PanStepTemplate(
        key="map_customers",
        owner=PanStepOwner.polar_app,
        kind=PanStepKind.auto,
    ),
    PanStepTemplate(
        key="stripe_review",
        owner=PanStepOwner.stripe,
        kind=PanStepKind.auto,
    ),
    PanStepTemplate(
        key="approve_import",
        owner=PanStepOwner.polar_ops,
        kind=PanStepKind.confirm,
    ),
    PanStepTemplate(
        key="stripe_import",
        owner=PanStepOwner.stripe,
        kind=PanStepKind.auto,
    ),
    PanStepTemplate(
        key=STEP_VERIFY_CARDS,
        owner=PanStepOwner.polar_app,
        kind=PanStepKind.auto,
    ),
    PanStepTemplate(
        key=STEP_RESOLVE_UNCOVERED,
        owner=PanStepOwner.merchant,
        kind=PanStepKind.confirm,
    ),
    PanStepTemplate(
        key=STEP_CUTOVER,
        owner=PanStepOwner.merchant,
        kind=PanStepKind.confirm,
    ),
    PanStepTemplate(
        key=STEP_MOVE_SUBSCRIPTIONS,
        owner=PanStepOwner.polar_app,
        kind=PanStepKind.auto,
    ),
)

_TEMPLATES: dict[PanTransferMethod, tuple[PanStepTemplate, ...]] = {
    PanTransferMethod.pan_copy: PAN_COPY_TEMPLATES,
    PanTransferMethod.pan_import: PAN_IMPORT_TEMPLATES,
}

_TEMPLATES_BY_KEY: dict[PanTransferMethod, dict[str, PanStepTemplate]] = {
    method: {template.key: template for template in templates}
    for method, templates in _TEMPLATES.items()
}


def templates_for(method: PanTransferMethod) -> tuple[PanStepTemplate, ...]:
    return _TEMPLATES[method]


def _template(method: PanTransferMethod, key: str) -> PanStepTemplate:
    template = _TEMPLATES_BY_KEY[method].get(key)
    if template is None:
        raise PanStepNotFound(key)
    return template


def build(method: PanTransferMethod) -> list[PanTransferStep]:
    """Instantiate a fresh checklist with only its first step actionable."""
    # Every field is set explicitly: this model is also an API response, and
    # ADR-0007 keeps output schemas free of defaults so the generated clients
    # don't mark always-present fields optional.
    steps = [
        PanTransferStep(
            key=template.key,
            owner=template.owner,
            kind=template.kind,
            status=PanStepStatus.blocked,
            inputs={},
            note=None,
            expected_at=None,
            started_at=None,
            completed_at=None,
            completed_by=None,
        )
        for template in templates_for(method)
    ]
    _advance(method, steps)
    return steps


def current(steps: Sequence[PanTransferStep]) -> PanTransferStep | None:
    """The one step that can be acted on, or None once the checklist is done."""
    for step in steps:
        if step.status in _ACTIONABLE:
            return step
    return None


def _get(steps: Sequence[PanTransferStep], key: str) -> PanTransferStep:
    for step in steps:
        if step.key == key:
            return step
    raise PanStepNotFound(key)


def _advance(method: PanTransferMethod, steps: list[PanTransferStep]) -> None:
    """Make the first unfinished step actionable, walking past any that complete
    on their own."""
    for step in steps:
        if step.status == PanStepStatus.completed:
            continue
        if step.status == PanStepStatus.blocked:
            step.status = PanStepStatus.pending
            step.started_at = utc_now()
        if not _template(method, step.key).auto_complete:
            return
        _settle(step, PanStepActor.system)


def _settle(step: PanTransferStep, actor: PanStepActor) -> None:
    step.status = PanStepStatus.completed
    step.completed_at = utc_now()
    step.completed_by = actor


def _validate_inputs(template: PanStepTemplate, inputs: dict[str, str]) -> None:
    errors: list[ValidationError] = [
        {
            "type": "extra_forbidden",
            "loc": ("body", "inputs", key),
            "msg": "This step doesn't accept this input.",
            "input": inputs[key],
        }
        for key in sorted(set(inputs) - template.accepted_inputs)
    ]
    errors += [
        {
            "type": "missing",
            "loc": ("body", "inputs", key),
            "msg": "This step needs this input.",
            "input": None,
        }
        for key in sorted(set(template.required_inputs) - set(inputs))
    ]
    if errors:
        raise PolarRequestValidationError(errors)


def complete(
    method: PanTransferMethod,
    steps: list[PanTransferStep],
    key: str,
    *,
    actor: PanStepActor,
    inputs: dict[str, str],
) -> list[PanTransferStep]:
    """Complete the current step and unblock whatever comes next.

    Raises rather than no-oping on a step that isn't current, so a stale client
    can't skip ahead or silently re-complete.
    """
    step = _get(steps, key)
    if step.status not in _ACTIONABLE:
        raise PanStepNotActionable(key)
    if step.owner not in _ACTOR_OWNERS[actor]:
        raise PanStepNotOwned(key, step.owner)

    # Blank is the same as absent, so an untouched optional field doesn't get
    # stored and an all-whitespace required one still reads as missing.
    provided = {k: v.strip() for k, v in inputs.items() if v.strip()}
    _validate_inputs(_template(method, key), provided)

    step.inputs = {**step.inputs, **provided}
    _settle(step, actor)
    _advance(method, steps)
    return steps


def annotate(
    steps: list[PanTransferStep],
    key: str,
    *,
    note: str | None = None,
    expected_at: datetime | None = None,
    clear_expected_at: bool = False,
    in_progress: bool = False,
) -> list[PanTransferStep]:
    """Ops-only. Say what a step we're waiting on is doing and when it should land.

    This is what turns "Stripe" from a dead badge into an explanation the merchant
    can read without opening a support thread.
    """
    step = _get(steps, key)
    if step.status == PanStepStatus.completed:
        raise PanStepNotActionable(key)
    if note is not None:
        step.note = note or None
    if expected_at is not None:
        step.expected_at = expected_at
    elif clear_expected_at:
        # A date has no "empty" value the way a note does, so dropping one has to
        # be asked for: otherwise an ETA could be set but never taken back.
        step.expected_at = None
    if in_progress:
        if step.status != PanStepStatus.pending:
            raise PanStepNotActionable(key)
        step.status = PanStepStatus.in_progress
    return steps
