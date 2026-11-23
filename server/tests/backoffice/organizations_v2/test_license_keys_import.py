import io
from typing import Any, cast

import pytest
from fastapi import UploadFile

from polar.backoffice.organizations_v2.license_keys_import import (
    license_keys_import,
)
from polar.benefit.grant.repository import BenefitGrantRepository
from polar.customer.repository import CustomerRepository
from polar.models import Benefit, BenefitGrant, Customer, Organization
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit


def _csv(*rows: str) -> UploadFile:
    header = "email,name,benefit_id,key,status,expires_at,activation_limit"
    content = "\n".join((header, *rows)) + "\n"
    return UploadFile(file=io.BytesIO(content.encode()), filename="keys.csv")


async def _run(
    session: AsyncSession, organization: Organization, file: UploadFile
) -> None:
    async for _ in license_keys_import(session, organization, file):
        pass


async def _license_key_benefit(
    save_fixture: SaveFixture, organization: Organization
) -> Benefit:
    return await create_benefit(
        save_fixture,
        type=BenefitType.license_keys,
        organization=organization,
        properties={
            "prefix": None,
            "expires": None,
            "activations": None,
            "limit_usage": None,
        },
    )


async def _grants(session: AsyncSession, benefit: Benefit) -> list[BenefitGrant]:
    repository = BenefitGrantRepository.from_session(session)
    return list(
        await repository.get_all(
            repository.get_base_statement().where(BenefitGrant.benefit_id == benefit.id)
        )
    )


@pytest.mark.anyio
class TestLicenseKeysImport:
    async def test_issues_each_key_without_an_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        benefit = await _license_key_benefit(save_fixture, organization)

        await _run(
            session,
            organization,
            _csv(
                f"{customer.email},,{benefit.id},LS-ONE,,2030-01-01,3",
                f"{customer.email},,{benefit.id},LS-TWO,disabled,,",
                f"new@example.com,New Customer,{benefit.id},LS-THREE,,,",
            ),
        )

        grants = await _grants(session, benefit)
        properties = {
            cast(dict[str, Any], grant.properties)["user_provided_key"]: cast(
                dict[str, Any], grant.properties
            )["user_provided_terms"]
            for grant in grants
        }
        assert properties == {
            "LS-ONE": {
                "status": "granted",
                "expires_at": "2030-01-01T00:00:00+00:00",
                "limit_activations": 3,
            },
            "LS-TWO": {
                "status": "disabled",
                "expires_at": None,
                "limit_activations": None,
            },
            "LS-THREE": {
                "status": "granted",
                "expires_at": None,
                "limit_activations": None,
            },
        }
        assert all(grant.order_id is None for grant in grants)
        assert all(grant.manually_granted_at is not None for grant in grants)
        new_customer = await CustomerRepository.from_session(
            session
        ).get_by_email_and_organization("new@example.com", organization.id)
        assert new_customer is not None
        assert new_customer.name == "New Customer"
