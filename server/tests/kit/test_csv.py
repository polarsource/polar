import pytest

from polar.kit.csv import get_emails_from_csv


@pytest.mark.asyncio
async def test_get_emails_from_csv() -> None:
    assert get_emails_from_csv(
        [
            "name,email",
            "hello world,foo@example.com",
            "froop",
            "bar,bar@example.com",
            "baz,bazexample.com",
        ]
    ) == {"foo@example.com", "bar@example.com"}

    assert (
        get_emails_from_csv(
            [
                "name,foo",
                "hello world,foo@example.com",
                "froop",
                "bar,bar@example.com",
                "baz,bazexample.com",
            ]
        )
        == set()
    )

    assert get_emails_from_csv(
        [
            "name,EMAIL",
            "hello world,foo@example.com",
            "froop",
            "bar,bar@example.com",
            "baz,bazexample.com",
        ]
    ) == {"foo@example.com", "bar@example.com"}

    assert get_emails_from_csv(
        [
            "name,Email",
            "hello world,foo@example.com",
            "froop",
            "bar,bar@example.com",
            "baz,bazexample.com",
        ]
    ) == {"foo@example.com", "bar@example.com"}
