import pytest
import respx
from httpx import Response
from pytest_mock import MockerFixture

from polar.config import settings
from polar.integrations.typesafe.client import API_URL
from polar.product.name_check import (
    check_product_name,
    find_flagged_phrase,
    pick_flagged_category,
)


class TestFindFlaggedPhrase:
    def test_matches_whole_words_case_insensitively(self) -> None:
        flagged = find_flagged_phrase("Gold Sponsorship Tier")
        assert flagged is not None
        assert flagged.category == "sponsorships and donations"
        assert flagged.phrase == "Sponsorship"

    def test_matches_plurals_and_multi_word_phrases(self) -> None:
        assert find_flagged_phrase("Monthly donations") is not None
        assert find_flagged_phrase("buy me a coffee") is not None

    def test_ignores_substrings(self) -> None:
        assert find_flagged_phrase("Customer Portal") is None
        assert find_flagged_phrase("Pro Plan") is None


class TestPickFlaggedCategory:
    def test_most_likely_category_at_or_above_threshold(self) -> None:
        assert pick_flagged_category({"gambling": 0.2, "weapons": 0.7}) == "weapons"
        assert pick_flagged_category({"gambling": 0.69, "weapons": 0.1}) is None


@pytest.mark.anyio
class TestCheckProductName:
    async def test_word_list_hit_skips_typesafe(
        self, respx_mock: respx.MockRouter
    ) -> None:
        route = respx_mock.post(API_URL)

        result = await check_product_name("Casino Night")

        assert result.category == "gambling"
        assert not route.called

    @pytest.mark.parametrize("api_key", ["DummyKey", ""])
    async def test_unconfigured_returns_nothing(
        self, mocker: MockerFixture, respx_mock: respx.MockRouter, api_key: str
    ) -> None:
        mocker.patch.object(settings, "PYDANTIC_AI_GATEWAY_API_KEY", api_key)
        route = respx_mock.post(API_URL)

        result = await check_product_name("Sponsoring mensuel")

        assert result.category is None
        assert not route.called

    async def test_typesafe_category(
        self, mocker: MockerFixture, respx_mock: respx.MockRouter
    ) -> None:
        mocker.patch.object(settings, "PYDANTIC_AI_GATEWAY_API_KEY", "test-key")
        route = respx_mock.post(API_URL).mock(
            return_value=Response(
                200,
                json={
                    "model": "jev-1.13.0",
                    "answers": {
                        "sponsorships and donations": {"type": "noul", "noul": 0.93},
                        "gambling": {"type": "noul", "noul": 0.04},
                    },
                },
            )
        )

        result = await check_product_name("Sponsoring mensuel")

        assert result.category == "sponsorships and donations"
        assert result.phrase is None
        request = route.calls.last.request
        assert request.headers["authorization"] == "Bearer test-key"

    async def test_typesafe_failure_returns_nothing(
        self, mocker: MockerFixture, respx_mock: respx.MockRouter
    ) -> None:
        mocker.patch.object(settings, "PYDANTIC_AI_GATEWAY_API_KEY", "test-key")
        respx_mock.post(API_URL).mock(return_value=Response(500))

        result = await check_product_name("Sponsoring mensuel")

        assert result.category is None
