"""Tests for the support-case URL helpers — notably the open-redirect guard on
``return_to``."""

from polar.backoffice.support_cases.urls import append_return_to, is_safe_return_to


class TestIsSafeReturnTo:
    def test_same_site_relative_path_allowed(self) -> None:
        assert is_safe_return_to("/backoffice/organizations/1?section=support_case")

    def test_none_and_empty_rejected(self) -> None:
        assert not is_safe_return_to(None)
        assert not is_safe_return_to("")

    def test_protocol_relative_and_absolute_rejected(self) -> None:
        assert not is_safe_return_to("//evil.example.com")
        assert not is_safe_return_to("https://evil.example.com")
        assert not is_safe_return_to("javascript:alert(1)")


class TestAppendReturnTo:
    def test_appends_with_question_mark(self) -> None:
        assert (
            append_return_to("/cases/abc", "/org/1")
            == "/cases/abc?return_to=%2Forg%2F1"
        )

    def test_appends_with_ampersand_when_query_present(self) -> None:
        assert (
            append_return_to("/cases/abc?x=1", "/org/1")
            == "/cases/abc?x=1&return_to=%2Forg%2F1"
        )

    def test_noop_for_unsafe_return_to(self) -> None:
        assert append_return_to("/cases/abc", "//evil.example.com") == "/cases/abc"
        assert append_return_to("/cases/abc", None) == "/cases/abc"
