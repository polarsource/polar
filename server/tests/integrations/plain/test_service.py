import contextlib
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from plain_client import (
    CustomerByEmailCustomerByEmail,
    UpsertCustomerUpsertCustomer,
)
from pytest_mock import MockerFixture

from polar.integrations.plain.service import PlainCustomerError, PlainService


@contextlib.asynccontextmanager
async def _mock_client(plain_mock: MagicMock) -> Any:
    yield plain_mock


_DATETIME = {
    "__typename": "DateTime",
    "iso8601": "2025-01-01T00:00:00Z",
    "unixTimestamp": "1735689600",
}


def _customer_dict(
    *, plain_customer_id: str = "c_123", external_id: str | None
) -> dict[str, Any]:
    return {
        "__typename": "Customer",
        "id": plain_customer_id,
        "fullName": "user@example.com",
        "shortName": None,
        "externalId": external_id,
        "email": {
            "__typename": "Email",
            "email": "user@example.com",
            "isVerified": False,
            "verifiedAt": None,
        },
        "company": None,
        "updatedAt": _DATETIME,
        "createdAt": _DATETIME,
        "createdBy": {"__typename": "SystemActor", "systemId": "system"},
        "markedAsSpamAt": None,
    }


def _customer_by_email_payload(
    *, plain_customer_id: str = "c_123", external_id: str | None
) -> CustomerByEmailCustomerByEmail:
    return CustomerByEmailCustomerByEmail.model_validate(
        _customer_dict(plain_customer_id=plain_customer_id, external_id=external_id)
    )


def _upsert_customer_payload(
    *, error: dict[str, Any] | None = None, with_customer: bool = True
) -> UpsertCustomerUpsertCustomer:
    customer = _customer_dict(external_id=str(uuid.uuid4())) if with_customer else None
    return UpsertCustomerUpsertCustomer.model_validate(
        {"result": "CREATED", "customer": customer, "error": error}
    )


@pytest.fixture
def plain_service(mocker: MockerFixture) -> PlainService:
    mocker.patch.object(PlainService, "enabled", True)
    return PlainService()


@pytest.fixture
def plain_client(mocker: MockerFixture) -> MagicMock:
    client = MagicMock()
    client.customer_by_email = AsyncMock()
    client.upsert_customer = AsyncMock()
    mocker.patch(
        "polar.integrations.plain.service.PlainService._get_plain_client",
        return_value=_mock_client(client),
    )
    return client


@pytest.mark.asyncio
class TestUpsertCustomer:
    async def test_noop_when_existing_customer_has_matching_external_id(
        self,
        plain_service: PlainService,
        plain_client: MagicMock,
    ) -> None:
        external_id = str(uuid.uuid4())
        plain_client.customer_by_email.return_value = _customer_by_email_payload(
            external_id=external_id
        )

        await plain_service.upsert_customer(
            external_id=external_id, email="user@example.com"
        )

        plain_client.upsert_customer.assert_not_called()

    async def test_upserts_by_email_when_existing_customer_has_different_external_id(
        self,
        plain_service: PlainService,
        plain_client: MagicMock,
    ) -> None:
        external_id = str(uuid.uuid4())
        plain_client.customer_by_email.return_value = _customer_by_email_payload(
            external_id="legacy-id"
        )
        plain_client.upsert_customer.return_value = _upsert_customer_payload()

        await plain_service.upsert_customer(
            external_id=external_id, email="user@example.com"
        )

        plain_client.upsert_customer.assert_awaited_once()
        upsert_input = plain_client.upsert_customer.call_args.args[0]
        assert upsert_input.identifier.email_address == "user@example.com"
        assert upsert_input.identifier.external_id is None
        assert upsert_input.on_update.external_id.value == external_id

    async def test_upserts_by_email_when_existing_customer_has_no_external_id(
        self,
        plain_service: PlainService,
        plain_client: MagicMock,
    ) -> None:
        external_id = str(uuid.uuid4())
        plain_client.customer_by_email.return_value = _customer_by_email_payload(
            external_id=None
        )
        plain_client.upsert_customer.return_value = _upsert_customer_payload()

        await plain_service.upsert_customer(
            external_id=external_id, email="user@example.com"
        )

        upsert_input = plain_client.upsert_customer.call_args.args[0]
        assert upsert_input.identifier.email_address == "user@example.com"
        assert upsert_input.on_update.external_id.value == external_id

    async def test_creates_with_external_id_when_no_existing_customer(
        self,
        plain_service: PlainService,
        plain_client: MagicMock,
    ) -> None:
        external_id = str(uuid.uuid4())
        plain_client.customer_by_email.return_value = None
        plain_client.upsert_customer.return_value = _upsert_customer_payload()

        await plain_service.upsert_customer(
            external_id=external_id, email="user@example.com"
        )

        upsert_input = plain_client.upsert_customer.call_args.args[0]
        assert upsert_input.identifier.external_id == external_id
        assert upsert_input.identifier.email_address is None

    async def test_raises_when_plain_returns_error(
        self,
        plain_service: PlainService,
        plain_client: MagicMock,
    ) -> None:
        external_id = str(uuid.uuid4())
        plain_client.customer_by_email.return_value = None
        plain_client.upsert_customer.return_value = _upsert_customer_payload(
            error={
                "__typename": "MutationError",
                "message": "boom",
                "type": "VALIDATION",
                "code": "duplicate_email",
                "fields": [],
            },
            with_customer=False,
        )

        with pytest.raises(PlainCustomerError):
            await plain_service.upsert_customer(
                external_id=external_id, email="user@example.com"
            )
