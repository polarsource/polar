import pytest

from polar.kit.email import EmailNotValidError, normalize_email, unalias_email


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


class TestNormalizeEmail:
    def test_strips_alias_suffix(self) -> None:
        assert normalize_email("pieter+123@polar.sh") == "pieter@polar.sh"

    def test_lowercases_local_part(self) -> None:
        assert normalize_email("Pieter@polar.sh") == "pieter@polar.sh"

    def test_lowercases_domain(self) -> None:
        assert normalize_email("pieter@POLAR.SH") == "pieter@polar.sh"

    def test_keeps_dots_outside_gmail(self) -> None:
        assert normalize_email("pieter.smith@polar.sh") == "pieter.smith@polar.sh"

    def test_strips_dots_for_gmail(self) -> None:
        assert normalize_email("pieter.smith@gmail.com") == "pietersmith@gmail.com"

    def test_maps_googlemail_to_gmail(self) -> None:
        assert normalize_email("pieter@googlemail.com") == "pieter@gmail.com"

    def test_strips_dots_for_googlemail(self) -> None:
        assert normalize_email("Pieter.Smith+123@GoogleMail.com") == (
            "pietersmith@gmail.com"
        )

    def test_strips_transparent_characters_for_proton(self) -> None:
        assert (
            normalize_email("pieter.smith_x-y@proton.me") == "pietersmithxy@proton.me"
        )

    def test_strips_transparent_characters_for_every_proton_domain(self) -> None:
        for domain in ("proton.me", "protonmail.com", "protonmail.ch", "pm.me"):
            assert normalize_email(f"pieter.smith@{domain}") == f"pietersmith@{domain}"

    def test_keeps_proton_domains_distinct(self) -> None:
        assert normalize_email("pieter@protonmail.com") != normalize_email(
            "pieter@proton.me"
        )

    def test_keeps_hyphens_and_underscores_outside_proton(self) -> None:
        assert normalize_email("pieter_s-x@gmail.com") == "pieter_s-x@gmail.com"

    def test_invalid_email_raises(self) -> None:
        with pytest.raises(EmailNotValidError):
            normalize_email("not-an-email")
