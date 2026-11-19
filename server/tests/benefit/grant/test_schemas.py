import pytest
from pydantic import ValidationError

from polar.benefit.grant.schemas import BenefitGrantLicenseKeyCreate


class TestBenefitGrantLicenseKeyCreate:
    def test_keeps_the_key_as_given(self) -> None:
        license_key = BenefitGrantLicenseKeyCreate(key=" LS-38B1460A ")

        assert license_key.key == " LS-38B1460A "

    @pytest.mark.parametrize(
        "data",
        [
            {"key": "   "},
            {"key": "LS-1", "limit_activations": 2**31},
        ],
    )
    def test_rejects_invalid_values(self, data: dict[str, object]) -> None:
        with pytest.raises(ValidationError):
            BenefitGrantLicenseKeyCreate.model_validate(data)
