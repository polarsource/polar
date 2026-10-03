import pytest

from scripts.classify_organization_taxonomy import (
    LABEL_BY_KEY,
    LABELS,
    Case,
    build_request,
    build_state,
    case_from_payload,
    interpret,
    resolve_jev_url,
)


def test_taxonomy_has_fifty_unique_labels() -> None:
    assert len(LABELS) == 50
    assert len(LABEL_BY_KEY) == 50
    assert {label.policy for label in LABELS} == {"allowed", "review", "prohibited"}
    assert all(label.criterion for label in LABELS)


def test_state_keeps_only_selling_fields() -> None:
    website = "x" * 9_000
    case = Case(
        name="Lexington Themes",
        slug="lexington",
        about="Astro themes",
        product_description="Premium themes",
        selling_categories=("Digital downloads",),
        pricing_models=("One-time purchase",),
        products=(
            {
                "name": "Brightlight",
                "description": "A theme",
                "billing_type": "one_time",
            },
        ),
        website_url="https://lexingtonthemes.com",
        website=website,
    )

    state = build_state(case)

    assert set(state) == {
        "name",
        "slug",
        "about",
        "product_description",
        "self_reported_selling_categories",
        "self_reported_pricing_models",
        "products",
        "website_url",
        "website",
    }
    assert len(state["website"]) == 8_000
    assert state["self_reported_selling_categories"] == ["Digital downloads"]


def test_request_choice_covers_every_label() -> None:
    request = build_request(Case(name="Stilla"))

    primary = request["questions"]["primary"]
    assert request["model"] == "typesafe-ai/jev"
    assert request["state"] == {"name": "Stilla"}
    assert primary["type"] == "choice"
    assert set(primary["criteria"]) == set(LABEL_BY_KEY)


def test_requests_go_through_the_vercel_ai_gateway() -> None:
    assert resolve_jev_url(None) == "https://ai-gateway.vercel.sh/typesafe/v1/systemone"
    assert (
        resolve_jev_url("https://ai-gateway.vercel.sh/typesafe")
        == "https://ai-gateway.vercel.sh/typesafe/v1/systemone"
    )
    assert (
        resolve_jev_url("https://ai-gateway.vercel.sh/typesafe/v1/systemone")
        == "https://ai-gateway.vercel.sh/typesafe/v1/systemone"
    )


def test_interpret_flags_a_weak_winner() -> None:
    probabilities = {label.key: 0.0 for label in LABELS}
    probabilities["hosted_software"] = 0.4
    probabilities["ai_text"] = 0.3

    result = interpret(
        {
            "choice": "hosted_software",
            "probabilities": probabilities,
            "confidence": 0.2,
        }
    )

    assert result["label"] == "hosted_software"
    assert result["policy"] == "allowed"
    assert result["needs_review"] is True
    assert result["runner_up"]["label"] == "ai_text"
    assert result["runner_up"]["policy"] == "review"


def test_interpret_rejects_an_unknown_label() -> None:
    with pytest.raises(ValueError, match="unknown label"):
        interpret(
            {
                "choice": "not_a_label",
                "probabilities": {"not_a_label": 1.0},
                "confidence": 1.0,
            }
        )


def test_payload_requires_a_name() -> None:
    with pytest.raises(Exception, match="name"):
        case_from_payload({"website": "https://example.com"})
