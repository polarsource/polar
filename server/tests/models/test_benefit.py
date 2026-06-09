import pytest

from polar.kit.visibility import Visibility
from polar.models.benefit import BenefitType


class TestBenefitTypeVisibility:
    @pytest.mark.parametrize(
        ("benefit_type", "expected"),
        [
            (BenefitType.discord, False),
            (BenefitType.github_repository, False),
            (BenefitType.downloadables, False),
            (BenefitType.custom, True),
            (BenefitType.meter_credit, True),
            (BenefitType.feature_flag, True),
            (BenefitType.license_keys, True),
        ],
    )
    def test_is_visibility_configurable(
        self, benefit_type: BenefitType, expected: bool
    ) -> None:
        assert benefit_type.is_visibility_configurable() is expected

    @pytest.mark.parametrize(
        ("benefit_type", "expected"),
        [
            (BenefitType.custom, Visibility.public),
            (BenefitType.meter_credit, Visibility.public),
            (BenefitType.feature_flag, Visibility.private),
            (BenefitType.discord, Visibility.public),
        ],
    )
    def test_default_visibility(
        self, benefit_type: BenefitType, expected: Visibility
    ) -> None:
        assert benefit_type.default_visibility() == expected

    def test_resolve_visibility_forces_public_for_interactive(self) -> None:
        assert (
            BenefitType.discord.resolve_visibility(Visibility.private)
            == Visibility.public
        )

    def test_resolve_visibility_uses_default_for_feature_flag(self) -> None:
        assert (
            BenefitType.feature_flag.resolve_visibility(None) == Visibility.private
        )
