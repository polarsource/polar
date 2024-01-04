import pytest

from polar.article.schemas import Article


@pytest.mark.asyncio
async def test_strip_paywalled_content() -> None:
    assert (
        Article.strip_paywalled_content(
            "before <Paywall>inside</Paywall> after",
            False,
        )
        == "before <Paywall></Paywall> after"
    )

    assert (
        Article.strip_paywalled_content(
            """
            before

            <Paywall>inside</Paywall>

            <Paywall>
            a
            b
            c
            d
            </Paywall>

            after
            """,
            False,
        )
        == """
            before

            <Paywall></Paywall>

            <Paywall></Paywall>

            after
            """
    )
