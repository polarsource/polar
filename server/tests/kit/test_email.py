import pytest

from polar.kit.email import EmailNotValidError, unalias_email


class TestUnaliasEmail:
    def test_strips_alias_suffix(self) -> None:
        assert unalias_email("pieter+123@polar.sh") == "pieter@polar.sh"

    def test_strips_only_first_plus(self) -> None:
        assert unalias_email("pieter+a+b@polar.sh") == "pieter@polar.sh"

    def test_passes_through_when_no_alias(self) -> None:
        assert unalias_email("pieter@polar.sh") == "pieter@polar.sh"

    def test_invalid_email_raises(self) -> None:
        with pytest.raises(EmailNotValidError):
            unalias_email("not-an-email")
