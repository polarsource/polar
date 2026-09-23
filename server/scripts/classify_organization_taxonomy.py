"""Classify an organization with Jev against the 50-label selling taxonomy.

Sends organization details and fetched website text to TypeSafe Jev
(``jev-1.13.0``). One Choice question picks the primary thing a buyer pays
for. The policy tag (allowed, review, prohibited) is applied here from the
Acceptable Use Policy; it is not part of the question.

Usage:
    cd server
    export TYPESAFE_API_KEY=...

    uv run python -m scripts.classify_organization_taxonomy --slug stilla
    uv run python -m scripts.classify_organization_taxonomy --input case.json
    uv run python -m scripts.classify_organization_taxonomy --slug stilla --skip-website
    uv run python -m scripts.classify_organization_taxonomy --input case.json --print-request

``TYPESAFE_BASE_URL`` overrides the API host. A root such as
``https://api.example.com`` is called at ``/v1/systemone``. A URL that already
ends with that path is used as-is.

``case.json`` fields: name, slug, about, product_description, website,
selling_categories, pricing_models, products (name, description, billing_type),
website_text. Website text already in the file is sent as-is. A website URL
with no text is fetched unless ``--skip-website`` is set.
"""

import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import typer

from polar.kit.db.postgres import create_async_sessionmaker
from polar.organization.repository import OrganizationRepository
from polar.organization_review.collectors.organization import collect_organization_data
from polar.organization_review.collectors.products import collect_products_data
from polar.organization_review.collectors.website import collect_website_data
from polar.organization_review.repository import OrganizationReviewRepository
from polar.organization_review.schemas import OrganizationData, ProductsData
from scripts.helper import configure_script_console_logging, read_engine, typer_async

JEV_URL = "https://api.typesafe.ai/v1/systemone"
JEV_MODEL = "jev-1.13.0"
MIN_PROBABILITY = 0.45
MIN_CONFIDENCE = 0.5
PRODUCT_LIMIT = 20
DESCRIPTION_LIMIT = 300
WEBSITE_CHAR_LIMIT = 8_000

INSTRUCTIONS = (
    "Which one label is what the buyer primarily pays this organization for? "
    "Judge the products and the website. Self-reported selling categories are "
    "the merchant's own claim and can be wrong. When a company also sells "
    "services elsewhere, classify what is sold here."
)


@dataclass(frozen=True)
class Label:
    key: str
    policy: str
    criterion: str


LABELS: tuple[Label, ...] = (
    Label(
        "open_source_support",
        "allowed",
        "The buyer pays to support a named free software project. "
        "No file or entitlement is normal.",
    ),
    Label(
        "hosted_software",
        "allowed",
        "The buyer pays for software the organization operates, "
        "including a team agent.",
    ),
    Label(
        "licensed_software",
        "allowed",
        "The buyer pays for an application they run themselves: "
        "desktop, mobile, or self-hosted.",
    ),
    Label(
        "developer_library",
        "allowed",
        "The buyer pays for an SDK, package, or library they embed "
        "in their own software.",
    ),
    Label(
        "api",
        "allowed",
        "The buyer pays to call an interface, often metered by usage.",
    ),
    Label(
        "game",
        "allowed",
        "The buyer pays to play a game.",
    ),
    Label(
        "website_template",
        "allowed",
        "The buyer pays for a page or site template file, such as a Framer template.",
    ),
    Label(
        "website_theme",
        "allowed",
        "The buyer pays for a full theme for a framework or CMS.",
    ),
    Label(
        "ui_kit",
        "allowed",
        "The buyer pays for components, a design system, or a boilerplate "
        "they copy into a codebase.",
    ),
    Label(
        "design_files",
        "allowed",
        "The buyer pays for design source files, icons, or fonts they keep.",
    ),
    Label(
        "media_files",
        "allowed",
        "The buyer pays for photos, footage, audio, or art files they keep.",
    ),
    Label(
        "video_project",
        "allowed",
        "The buyer pays for a video project file they render themselves.",
    ),
    Label(
        "course",
        "allowed",
        "The buyer pays for lessons or a recorded cohort.",
    ),
    Label(
        "ebook_or_pdf",
        "review",
        "The buyer pays for an ebook, guide, or PDF.",
    ),
    Label(
        "paid_publication",
        "allowed",
        "The buyer pays for a newsletter or an ongoing written publication.",
    ),
    Label(
        "productivity_software",
        "allowed",
        "The buyer pays for a tracker, calculator, or budgeting tool "
        "that does not move money or give investment advice.",
    ),
    Label(
        "writing_assistant",
        "allowed",
        "The buyer pays for software that rewrites, translates, or drafts text "
        "for their own channels.",
    ),
    Label(
        "feedback_tool",
        "allowed",
        "The buyer pays for software that collects testimonials "
        "from their own customers.",
    ),
    Label(
        "directory",
        "review",
        "The buyer pays for a curated directory or board.",
    ),
    Label(
        "preorder",
        "review",
        "The buyer pays before a working product exists.",
    ),
    Label(
        "vpn_or_vps",
        "review",
        "The buyer pays for a VPN, VPS, or VDS.",
    ),
    Label(
        "tickets",
        "review",
        "The buyer pays for an event ticket.",
    ),
    Label(
        "ai_text",
        "review",
        "The paid product is generated text.",
    ),
    Label(
        "ai_image_or_video",
        "review",
        "The paid product generates images or video, or starts that generation.",
    ),
    Label(
        "ai_audio",
        "review",
        "The paid product generates music, audio, or voice.",
    ),
    Label(
        "hiring_or_exam_tool",
        "review",
        "The buyer pays for resume, hiring, or original exam-practice software.",
    ),
    Label(
        "spiritual",
        "review",
        "The buyer pays for a spiritual or astrology product.",
    ),
    Label(
        "physical_good",
        "prohibited",
        "The buyer pays for a physical thing that is shipped or handed over.",
    ),
    Label(
        "human_service",
        "prohibited",
        "The buyer pays for a person's time: coaching, consulting, "
        "freelance, or repair.",
    ),
    Label(
        "charity_or_crowdfunding",
        "prohibited",
        "The buyer pays to fund a cause or a crowdfunding campaign.",
    ),
    Label(
        "community_only",
        "prohibited",
        "The buyer pays only to join a group of people.",
    ),
    Label(
        "advertising_or_outreach",
        "prohibited",
        "The buyer pays for leads, bulk messaging, automated outreach, "
        "or ad placements.",
    ),
    Label(
        "marketplace",
        "prohibited",
        "Other people sell through this organization, or it sells "
        "other people's products for a cut.",
    ),
    Label(
        "adult",
        "prohibited",
        "The buyer pays for adult content, adult AI, an AI relationship, or dating.",
    ),
    Label(
        "minors",
        "prohibited",
        "The product is used by, made for, or advertised to children.",
    ),
    Label(
        "gambling",
        "prohibited",
        "The buyer pays to bet, or for loot boxes or mystery boxes.",
    ),
    Label(
        "illegal_goods",
        "prohibited",
        "The buyer pays for drugs, alcohol, tobacco, vaping, weapons, "
        "or another regulated good.",
    ),
    Label(
        "financial_trading",
        "prohibited",
        "The buyer pays for trades, bots, brokerage, signals, crypto, NFTs, "
        "or a held balance.",
    ),
    Label(
        "financial_advice",
        "prohibited",
        "The buyer pays for tax, wealth, or investment-strategy advice.",
    ),
    Label(
        "get_rich",
        "prohibited",
        "The product's promise is that the buyer will get rich.",
    ),
    Label(
        "cheating",
        "prohibited",
        "The buyer pays for game macros, cheats, or hacks.",
    ),
    Label(
        "circumvention",
        "prohibited",
        "The buyer pays to bypass a paywall or terms, download someone else's "
        "content, remove a watermark, resell a software license, "
        "or obtain real past exam papers.",
    ),
    Label(
        "job_board",
        "prohibited",
        "The buyer pays for a board of job openings.",
    ),
    Label(
        "travel_or_government",
        "prohibited",
        "The buyer pays for travel services or a government service.",
    ),
    Label(
        "iptv",
        "prohibited",
        "The buyer pays for IPTV, or for software whose purpose is delivering IPTV.",
    ),
    Label(
        "malware_or_cloaking",
        "prohibited",
        "The buyer pays for viruses, spyware, or API or IP cloaking.",
    ),
    Label(
        "unauthorized_access",
        "prohibited",
        "The buyer pays for access to data or systems they do not own.",
    ),
    Label(
        "personal_data",
        "prohibited",
        "The buyer pays for aggregated personal data or customer data.",
    ),
    Label(
        "ip_infringement",
        "prohibited",
        "The buyer pays for pirated content, a counterfeit, a deepfake, "
        "a face swap, or trademark removal.",
    ),
    Label(
        "deceptive_proof",
        "prohibited",
        "The buyer pays for fabricated reviews or inflated social proof, "
        "or for a medical diagnosis or a treatment plan.",
    ),
)

LABEL_BY_KEY: dict[str, Label] = {label.key: label for label in LABELS}


@dataclass(frozen=True)
class Case:
    name: str
    slug: str | None = None
    about: str | None = None
    product_description: str | None = None
    selling_categories: tuple[str, ...] = ()
    pricing_models: tuple[str, ...] = ()
    products: tuple[dict[str, str], ...] = ()
    website_url: str | None = None
    website: str | None = None
    website_error: str | None = None


def build_questions() -> dict[str, Any]:
    return {
        "primary": {
            "type": "choice",
            "instructions": INSTRUCTIONS,
            "criteria": {label.key: label.criterion for label in LABELS},
        }
    }


def build_state(case: Case) -> dict[str, Any]:
    products = []
    for product in case.products[:PRODUCT_LIMIT]:
        entry: dict[str, str] = {"name": product["name"]}
        description = product.get("description", "")
        if description:
            entry["description"] = description[:DESCRIPTION_LIMIT]
        billing_type = product.get("billing_type", "")
        if billing_type:
            entry["billing_type"] = billing_type
        products.append(entry)

    state: dict[str, Any] = {"name": case.name}
    if case.slug:
        state["slug"] = case.slug
    if case.about:
        state["about"] = case.about
    if case.product_description:
        state["product_description"] = case.product_description
    if case.selling_categories:
        state["self_reported_selling_categories"] = list(case.selling_categories)
    if case.pricing_models:
        state["self_reported_pricing_models"] = list(case.pricing_models)
    if products:
        state["products"] = products
    if case.website_url:
        state["website_url"] = case.website_url
    if case.website:
        state["website"] = case.website[:WEBSITE_CHAR_LIMIT]
    if case.website_error:
        state["website_error"] = case.website_error
    return state


def build_request(case: Case, model: str = JEV_MODEL) -> dict[str, Any]:
    return {
        "model": model,
        "state": build_state(case),
        "questions": build_questions(),
    }


def interpret(answer: dict[str, Any]) -> dict[str, Any]:
    choice = answer["choice"]
    label = LABEL_BY_KEY.get(choice)
    if label is None:
        raise ValueError(f"Jev returned an unknown label: {choice}")
    probabilities: dict[str, float] = answer["probabilities"]
    probability = float(probabilities[choice])
    confidence = float(answer["confidence"])
    ranked = sorted(probabilities.items(), key=lambda item: item[1], reverse=True)
    runner_up = None
    if len(ranked) > 1:
        runner_key, runner_probability = ranked[1]
        runner_label = LABEL_BY_KEY[runner_key]
        runner_up = {
            "label": runner_key,
            "policy": runner_label.policy,
            "probability": runner_probability,
        }
    return {
        "label": choice,
        "policy": label.policy,
        "description": label.criterion,
        "probability": probability,
        "confidence": confidence,
        "needs_review": probability < MIN_PROBABILITY or confidence < MIN_CONFIDENCE,
        "runner_up": runner_up,
    }


def case_from_payload(payload: dict[str, Any]) -> Case:
    name = payload.get("name")
    if not isinstance(name, str) or not name.strip():
        raise typer.BadParameter("input JSON needs a name")
    products = tuple(
        {
            "name": str(product.get("name", "")),
            "description": str(product.get("description") or ""),
            "billing_type": str(product.get("billing_type") or ""),
        }
        for product in payload.get("products") or []
        if product.get("name")
    )
    return Case(
        name=name.strip(),
        slug=payload.get("slug"),
        about=payload.get("about"),
        product_description=payload.get("product_description"),
        selling_categories=tuple(payload.get("selling_categories") or []),
        pricing_models=tuple(payload.get("pricing_models") or []),
        products=products,
        website_url=payload.get("website"),
        website=payload.get("website_text"),
    )


def case_from_organization(
    organization: OrganizationData, products: ProductsData
) -> Case:
    rows = tuple(
        {
            "name": product.name,
            "description": product.description or "",
            "billing_type": product.billing_type or "",
        }
        for product in products.products
        if not product.is_archived
    )
    return Case(
        name=organization.name,
        slug=organization.slug,
        about=organization.about,
        product_description=organization.product_description,
        selling_categories=tuple(organization.selling_categories),
        pricing_models=tuple(organization.pricing_models),
        products=rows,
        website_url=organization.website,
    )


async def load_case_from_slug(slug: str) -> Case:
    engine = read_engine(command_timeout=30)
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker() as session:
            organization = await OrganizationRepository.from_session(
                session
            ).get_by_slug(slug)
            if organization is None:
                raise typer.BadParameter(f"No organization with slug {slug}")
            organization_data = collect_organization_data(organization)
            product_rows = await OrganizationReviewRepository.from_session(
                session
            ).get_products_with_prices(organization.id)
            product_data = collect_products_data(product_rows)
    finally:
        await engine.dispose()
    return case_from_organization(organization_data, product_data)


async def attach_website(case: Case) -> Case:
    if case.website or not case.website_url:
        return case

    fetched = await collect_website_data(
        case.website_url,
        organization_slug=case.slug,
    )
    text = fetched.summary
    if not text:
        text = "\n\n".join(
            f"{page.title or page.url}\n{page.content}"
            for page in fetched.pages
            if page.content
        )
    return Case(
        name=case.name,
        slug=case.slug,
        about=case.about,
        product_description=case.product_description,
        selling_categories=case.selling_categories,
        pricing_models=case.pricing_models,
        products=case.products,
        website_url=case.website_url,
        website=text or None,
        website_error=fetched.scrape_error,
    )


async def call_jev(
    request: dict[str, Any], *, api_key: str, base_url: str | None = None
) -> dict[str, Any]:
    if not base_url:
        url = JEV_URL
    else:
        root = base_url.rstrip("/")
        url = root if root.endswith("/v1/systemone") else f"{root}/v1/systemone"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    retryable = {429, 529}
    async with httpx.AsyncClient(timeout=30) as client:
        for attempt in range(4):
            response = await client.post(url, headers=headers, json=request)
            if response.status_code not in retryable or attempt == 3:
                response.raise_for_status()
                body: dict[str, Any] = response.json()
                return body
            await asyncio.sleep(2**attempt)
    raise RuntimeError("Jev request did not return")


def render(result: dict[str, Any], *, raw: dict[str, Any] | None = None) -> str:
    payload = {
        "model": (raw or {}).get("model", JEV_MODEL),
        **result,
        "usage": (raw or {}).get("usage"),
    }
    return json.dumps(payload, indent=2)


@typer_async
async def main(
    slug: str | None = typer.Option(None, "--slug", help="Organization slug"),
    input_path: Path | None = typer.Option(
        None, "--input", help="JSON file with org details and optional website text"
    ),
    skip_website: bool = typer.Option(
        False, "--skip-website", help="Do not fetch the website"
    ),
    print_request: bool = typer.Option(
        False, "--print-request", help="Print the Jev request and do not call the API"
    ),
    as_json: bool = typer.Option(False, "--json", help="Print the raw JSON result"),
    model: str = typer.Option(JEV_MODEL, "--model"),
) -> None:
    configure_script_console_logging()
    if (slug is None) == (input_path is None):
        raise typer.BadParameter("Pass exactly one of --slug or --input")

    if input_path is not None:
        case = case_from_payload(json.loads(input_path.read_text()))
    else:
        assert slug is not None
        case = await load_case_from_slug(slug)

    if not skip_website:
        case = await attach_website(case)

    request = build_request(case, model=model)
    if print_request:
        typer.echo(json.dumps(request, indent=2))
        return

    api_key = os.environ.get("TYPESAFE_API_KEY")
    if not api_key:
        raise typer.BadParameter("TYPESAFE_API_KEY is not set")
    raw = await call_jev(
        request,
        api_key=api_key,
        base_url=os.environ.get("TYPESAFE_BASE_URL"),
    )
    result = interpret(raw["answers"]["primary"])
    if as_json:
        typer.echo(render(result, raw=raw))
        return

    review = " review" if result["needs_review"] else ""
    typer.echo(
        f"{case.slug or case.name}  {result['label']}  {result['policy']}  "
        f"p={result['probability']:.2f}  confidence={result['confidence']:.2f}{review}"
    )
    runner_up = result["runner_up"]
    if runner_up is not None:
        typer.echo(
            f"runner-up: {runner_up['label']}  {runner_up['policy']}  "
            f"p={runner_up['probability']:.2f}"
        )


if __name__ == "__main__":
    typer.run(main)
