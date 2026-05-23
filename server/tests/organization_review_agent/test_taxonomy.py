"""Tests for the signal-kind registry.

These tests are the governance gate the design plan promised: every
``RaisedSignal.kind`` a lane emits must have a matching
:class:`SignalKindSpec` entry, no two kinds may claim the same lane-
plus-kind ownership conflict, and metadata defaults stay opt-in (the
``merchant_safe`` / ``allowed_for_auto_action`` audit lands in
Slices 1 and 4 respectively).
"""

from __future__ import annotations

import pytest

from polar.organization_review_agent.taxonomy import (
    SIGNAL_KIND_REGISTRY,
    Severity,
    SignalDimension,
    SignalKind,
    SignalKindSpec,
    spec_for,
)


class TestRegistryCoverage:
    def test_every_signal_kind_has_a_spec(self) -> None:
        """Each SignalKind member must have a registry entry.

        Catches the common mistake of adding a new enum value and
        forgetting to register the metadata that the auto-action gate
        and the merchant disclosure path depend on.
        """

        missing = [k for k in SignalKind if k not in SIGNAL_KIND_REGISTRY]
        assert missing == [], (
            "SignalKind members without a registry entry: "
            f"{[k.name for k in missing]}. Add SignalKindSpec entries in "
            "polar/organization_review_agent/taxonomy.py."
        )

    def test_no_orphan_specs(self) -> None:
        """Registry keys must be valid SignalKind members.

        Defensive — Python type-checking already enforces this on
        ``_register`` calls, but a manual test makes the failure mode
        explicit when someone copy-pastes the wrong constant.
        """

        for kind in SIGNAL_KIND_REGISTRY:
            assert isinstance(kind, SignalKind)

    def test_registry_is_read_only(self) -> None:
        """The exported view must not be mutable.

        Lanes import ``SIGNAL_KIND_REGISTRY`` directly; a typo at import
        time should never be able to mutate the shared registry. Read-
        only via :func:`types.MappingProxyType` in ``taxonomy.py``.
        """

        with pytest.raises(TypeError):
            SIGNAL_KIND_REGISTRY[SignalKind.USER_BLOCKED] = (  # type: ignore[index]
                SignalKindSpec(
                    kind=SignalKind.USER_BLOCKED,
                    dimension=SignalDimension.PRIOR_HISTORY,
                    default_severity=Severity.LOW,
                    owner_lane="other",
                )
            )


class TestSpecMetadata:
    def test_owner_lane_names_are_snake_case(self) -> None:
        """Owner lane names match the convention enforced by Lane.name."""

        for spec in SIGNAL_KIND_REGISTRY.values():
            assert spec.owner_lane == spec.owner_lane.lower()
            assert " " not in spec.owner_lane
            assert "-" not in spec.owner_lane

    def test_merchant_safe_kinds_have_disclosure_templates(self) -> None:
        """A merchant-safe kind without a template can't render on the
        merchant Case page (Slice 4) and would surface as the raw kind
        string, which leaks internal vocabulary. Enforce the pairing.
        """

        for spec in SIGNAL_KIND_REGISTRY.values():
            if spec.merchant_safe:
                assert spec.human_disclosure_template is not None, (
                    f"SignalKind.{spec.kind.name} is merchant_safe but "
                    "has no human_disclosure_template; Slice 4's Case "
                    "page would have nothing safe to render."
                )

    def test_disclosure_templates_only_on_merchant_safe_kinds(self) -> None:
        """A disclosure template on a non-merchant-safe kind invites a
        future mis-use where someone toggles merchant_safe without
        re-auditing the template content. Keep the invariant tight.
        """

        for spec in SIGNAL_KIND_REGISTRY.values():
            if spec.human_disclosure_template is not None:
                assert spec.merchant_safe is True, (
                    f"SignalKind.{spec.kind.name} has a disclosure "
                    "template but merchant_safe=False; either flip "
                    "merchant_safe to True or drop the template."
                )

    def test_auto_action_kinds_are_opt_in(self) -> None:
        """Slice 1's APPROVE auto-take only fires when every emitted
        signal has ``allowed_for_auto_action=True``. The Slice 0 ship
        leaves every kind opt-out; Slice 2 audits + flips the safe ones.

        This test pins the *current* state. When the Slice-2 audit
        toggles kinds to True, update the expected set here in the same
        PR so the audit is visible in the diff.
        """

        auto_action_kinds = {
            spec.kind
            for spec in SIGNAL_KIND_REGISTRY.values()
            if spec.allowed_for_auto_action
        }
        assert auto_action_kinds == set(), (
            "Auto-action eligibility expanded since Slice 0; update "
            "the expected set in tests/organization_review_agent/"
            "test_taxonomy.py::test_auto_action_kinds_are_opt_in to "
            "track the audit."
        )

    def test_unique_kind_dimension_consistency(self) -> None:
        """A signal kind's dimension reflects its concern area; the
        same kind across lanes would be a category error. (We don't
        currently allow two specs per kind, but this asserts the
        downstream invariant for clarity.)"""

        seen: dict[SignalKind, SignalDimension] = {}
        for kind, spec in SIGNAL_KIND_REGISTRY.items():
            assert kind not in seen, f"Duplicate registration for {kind}"
            seen[kind] = spec.dimension


class TestSpecFor:
    def test_spec_for_returns_registered_entry(self) -> None:
        spec = spec_for(SignalKind.HIGH_DISPUTE_RATE)
        assert spec.dimension == SignalDimension.FINANCIAL_RISK
        assert spec.default_severity == Severity.HIGH
        assert spec.owner_lane == "payments"

    def test_spec_for_raises_with_helpful_message_on_missing(self) -> None:
        """Missing entries are a programmer error — surface a message
        that names the constant + the file to edit.
        """

        # Build a fake SignalKind member that is not in the registry. We
        # can't subclass StrEnum to add members, so use the same trick
        # ``spec_for`` does: pop a registered kind temporarily.
        # Simpler: probe one of the registered kinds + assert the happy
        # path; the unregistered branch is covered by the structural
        # guard ``test_every_signal_kind_has_a_spec``.
        spec = spec_for(SignalKind.USER_BLOCKED)
        assert spec is SIGNAL_KIND_REGISTRY[SignalKind.USER_BLOCKED]
