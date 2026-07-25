import pytest
from pydantic import TypeAdapter, ValidationError

from polar.benefit.strategies.link.schemas import LinkUrl
from polar.benefit.strategies.link.service import BenefitLinkService, resolve_link_url
from polar.models import Organization
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_customer,
    create_member,
)


class TestLinkUrl:
    adapter = TypeAdapter(LinkUrl)

    @pytest.mark.parametrize(
        "url",
        [
            "https://example.com/welcome",
            "https://example.com/welcome?email={CUSTOMER_EMAIL}",
            "https://example.com/{CUSTOMER_EXTERNAL_ID}/welcome",
            "https://example.com/w?e={CUSTOMER_EMAIL}&uid={CUSTOMER_EXTERNAL_ID}",
        ],
    )
    def test_accepts_supported_placeholders(self, url: str) -> None:
        assert self.adapter.validate_python(url) == url

    @pytest.mark.parametrize(
        ("url", "unknown"),
        [
            ("https://example.com/w?e={CUSTOMER_EMAL}", "{CUSTOMER_EMAL}"),
            ("https://example.com/w?e={customer_email}", "{customer_email}"),
            ("https://example.com/{FOO}/welcome", "{FOO}"),
        ],
    )
    def test_rejects_unknown_placeholder(self, url: str, unknown: str) -> None:
        with pytest.raises(ValidationError) as excinfo:
            self.adapter.validate_python(url)
        assert f"Unknown placeholder {unknown}" in excinfo.value.errors()[0]["msg"]

    def test_ignores_non_placeholder_braces(self) -> None:
        url = 'https://example.com/w?filter={"a":1}'
        assert "{" in str(self.adapter.validate_python(url))


class TestResolveLinkUrl:
    def test_no_placeholders(self) -> None:
        url = "https://example.com/welcome"
        assert (
            resolve_link_url(url, email="customer@example.com", external_id="abc")
            == url
        )

    def test_substitutes_and_url_encodes(self) -> None:
        url = "https://example.com/welcome?email={CUSTOMER_EMAIL}&uid={CUSTOMER_EXTERNAL_ID}"
        assert resolve_link_url(
            url, email="customer+test@example.com", external_id="user/123"
        ) == (
            "https://example.com/welcome?email=customer%2Btest%40example.com&uid=user%2F123"
        )

    def test_missing_external_id_substitutes_empty(self) -> None:
        url = "https://example.com/welcome?uid={CUSTOMER_EXTERNAL_ID}"
        assert (
            resolve_link_url(url, email="customer@example.com", external_id=None)
            == "https://example.com/welcome?uid="
        )


@pytest.mark.asyncio
class TestGrant:
    async def test_resolves_customer_placeholders(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
            external_id="ext-123",
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.link,
            properties={
                "url": "https://example.com/welcome?email={CUSTOMER_EMAIL}&uid={CUSTOMER_EXTERNAL_ID}",
                "label": "Open app",
            },
        )

        service = BenefitLinkService(session, redis)
        properties = await service.grant(benefit, customer, {})

        assert properties == {
            "url": "https://example.com/welcome?email=customer%40example.com&uid=ext-123"
        }

    async def test_member_grant_uses_member_email(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="team@example.com"
        )
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="member@example.com",
        )
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.link,
            properties={
                "url": "https://example.com/welcome?email={CUSTOMER_EMAIL}",
                "label": None,
            },
        )

        service = BenefitLinkService(session, redis)
        properties = await service.grant(benefit, customer, {}, member=member)

        assert properties == {
            "url": "https://example.com/welcome?email=member%40example.com"
        }


@pytest.mark.asyncio
class TestRequiresUpdate:
    async def test_url_changed(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.link,
            properties={"url": "https://example.com/new", "label": None},
        )

        service = BenefitLinkService(session, redis)
        assert (
            await service.requires_update(
                benefit, {"url": "https://example.com/old", "label": None}
            )
            is True
        )
        assert (
            await service.requires_update(
                benefit, {"url": "https://example.com/new", "label": "Changed label"}
            )
            is False
        )
