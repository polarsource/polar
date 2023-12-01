import pytest

from polar.article.schemas import Article


@pytest.mark.asyncio
async def test_strip_paywalled_content() -> None:
    assert (
        Article.strip_paywalled_content(
            "before <paywall>inside</paywall> after",
            False,
        )
        == "before <paywall></paywall> after"
    )

    assert (
        Article.strip_paywalled_content(
            """
            before
            
            <paywall>inside</paywall>

            <paywall>
            a
            b
            c
            d
            </paywall>
            
            after
            """,
            False,
        )
        == """
            before
            
            <paywall></paywall>

            <paywall></paywall>
            
            after
            """
    )
