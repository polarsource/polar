import pytest
from pydantic_ai.messages import ModelMessage, ModelResponse, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

from polar.product.name_check import (
    check_product_name,
    find_flagged_phrase,
    jev_agent,
)


def jev_answers(category: str | None, confidence: float) -> FunctionModel:
    def respond(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        return ModelResponse(
            parts=[
                ToolCallPart(
                    tool_name=info.output_tools[0].name,
                    args={"category": category},
                )
            ],
            provider_details={"confidence": {"category": confidence}},
        )

    return FunctionModel(respond)


def jev_unavailable() -> FunctionModel:
    def fail(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        raise RuntimeError("gateway down")

    return FunctionModel(fail)


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


@pytest.mark.anyio
class TestCheckProductName:
    async def test_word_list_hit_skips_jev(self) -> None:
        with jev_agent().override(model=jev_unavailable()):
            result = await check_product_name("Casino Night")

        assert result.category == "gambling"

    async def test_jev_category(self) -> None:
        with jev_agent().override(
            model=jev_answers("sponsorships and donations", 0.93)
        ):
            result = await check_product_name("Sponsoring mensuel")

        assert result.category == "sponsorships and donations"
        assert result.phrase is None

    async def test_jev_none_of_these(self) -> None:
        with jev_agent().override(model=jev_answers(None, 0.95)):
            result = await check_product_name("Monatsabo Premium")

        assert result.category is None

    async def test_low_confidence_returns_nothing(self) -> None:
        with jev_agent().override(model=jev_answers("gambling", 0.4)):
            result = await check_product_name("Sponsoring mensuel")

        assert result.category is None

    async def test_jev_failure_returns_nothing(self) -> None:
        with jev_agent().override(model=jev_unavailable()):
            result = await check_product_name("Sponsoring mensuel")

        assert result.category is None
