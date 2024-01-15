import pytest

from polar.article.schemas import Article


@pytest.mark.asyncio
async def test_cut_premium_content() -> None:
    assert (
        Article.cut_premium_content(
            "before <Paywall>inside</Paywall> after",
            False,
            False,
        )
        == "before <Paywall></Paywall> after"
    )

    assert (
        Article.cut_premium_content(
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
            False,
        )
        == """
            before

            <Paywall></Paywall>

            <Paywall></Paywall>

            after
            """
    )

    assert Article.cut_premium_content("a" * 1200, True, False) == "a" * 500
