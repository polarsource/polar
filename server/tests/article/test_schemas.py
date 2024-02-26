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

    assert 1000 == len(Article.cut_premium_content("a" * 1200, True, False))
    assert "a" * 1000 == Article.cut_premium_content("a" * 1200, True, False)

    a = "a" * 400
    an = a + "\n\n"

    assert 400 == len(Article.cut_premium_content(an * 5, True, False))

    assert a == Article.cut_premium_content(an * 5, True, False)

    assert "before\nhey!" == Article.cut_premium_content(
        """before
hey!

---

            <Paywall>inside</Paywall>

            <Paywall>
            a
            b
            c
            d
            </Paywall>

            after
            """,
        True,
        False,
    )

    assert "" == Article.cut_premium_content(
        """<hr>

            <Paywall>inside</Paywall>

            <Paywall>
            a
            b
            c
            d
            </Paywall>

            after
            """,
        True,
        False,
    )
