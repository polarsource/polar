import pytest
from pydantic_ai.messages import ModelMessage, ModelResponse, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

from polar.organization.description_check import (
    CONCERNS,
    check_product_description,
    jev_agent,
)
from polar.organization.schemas import (
    ProductDescriptionCheckRequest,
    ProductDescriptionCheckRound,
)


def jev_answers(
    concern: str | None, confidence: float, prompts: list[str] | None = None
) -> FunctionModel:
    def respond(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        if prompts is not None:
            prompts.extend(
                str(part.content)
                for message in messages
                for part in message.parts
                if part.part_kind == "user-prompt"
            )
        return ModelResponse(
            parts=[
                ToolCallPart(
                    tool_name=info.output_tools[0].name,
                    args={"concern": concern},
                )
            ],
            provider_details={"confidence": {"concern": confidence}},
        )

    return FunctionModel(respond)


def jev_unavailable() -> FunctionModel:
    def fail(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        raise RuntimeError("gateway down")

    return FunctionModel(fail)


def request(**kwargs: object) -> ProductDescriptionCheckRequest:
    return ProductDescriptionCheckRequest.model_validate(
        {"product_description": "A SaaS to manage invoices.", **kwargs}
    )


@pytest.mark.anyio
class TestCheckProductDescription:
    async def test_no_concern(self) -> None:
        with jev_agent().override(model=jev_answers(None, 0.95)):
            result = await check_product_description(request())

        assert result.verdict == "APPROVE"
        assert result.category is None
        assert result.message is None

    async def test_deny_concern(self) -> None:
        with jev_agent().override(model=jev_answers("gambling", 0.9)):
            result = await check_product_description(request())

        assert result.verdict == "DENY"
        assert result.category == "gambling"
        assert result.message == CONCERNS["gambling"].message

    async def test_clarify_concern(self) -> None:
        with jev_agent().override(model=jev_answers("crypto", 0.9)):
            result = await check_product_description(request())

        assert result.verdict == "CLARIFY"
        assert result.message == CONCERNS["crypto"].message

    async def test_low_confidence_approves(self) -> None:
        with jev_agent().override(model=jev_answers("gambling", 0.4)):
            result = await check_product_description(request())

        assert result.verdict == "APPROVE"

    async def test_jev_failure_approves(self) -> None:
        with jev_agent().override(model=jev_unavailable()):
            result = await check_product_description(request())

        assert result.verdict == "APPROVE"

    async def test_prompt_includes_only_denied_history(self) -> None:
        prompts: list[str] = []
        with jev_agent().override(model=jev_answers(None, 0.95, prompts)):
            await check_product_description(
                request(
                    selling_categories=["Software"],
                    history=[
                        ProductDescriptionCheckRound(
                            product_description="Online casino", verdict="DENY"
                        ),
                        ProductDescriptionCheckRound(
                            product_description="Crypto tracker", verdict="CLARIFY"
                        ),
                    ],
                )
            )

        assert "Previously denied description: Online casino" in prompts[0]
        assert "Crypto tracker" not in prompts[0]
        assert "Selling categories: Software" in prompts[0]
        assert "Pricing models: Not specified" in prompts[0]
