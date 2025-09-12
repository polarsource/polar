import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import CheckoutLink, Product
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout_link


@pytest_asyncio.fixture
async def checkout_link(save_fixture: SaveFixture, product: Product) -> CheckoutLink:
    return await create_checkout_link(
        save_fixture,
        products=[product],
        success_url="https://example.com/success",
        user_metadata={"key": "value"},
    )


@pytest_asyncio.fixture
async def deleted_checkout_link(save_fixture: SaveFixture, product: Product) -> CheckoutLink:
    checkout_link = await create_checkout_link(
        save_fixture,
        products=[product],
        success_url="https://example.com/success",
        user_metadata={"key": "value"},
    )
    # Soft delete the checkout link
    checkout_link.set_deleted_at()
    await save_fixture(checkout_link)
    return checkout_link


@pytest.mark.asyncio
class TestListCheckoutLinks:
    async def test_list_active_only(
        self, client: AsyncClient, checkout_link: CheckoutLink, deleted_checkout_link: CheckoutLink
    ) -> None:
        response = await client.get("/backoffice/checkout-links/")
        assert response.status_code == 200
        content = response.text
        # Should show active checkout link
        assert str(checkout_link.id) in content
        # Should NOT show deleted checkout link by default
        assert str(deleted_checkout_link.id) not in content

    async def test_list_include_deleted(
        self, client: AsyncClient, checkout_link: CheckoutLink, deleted_checkout_link: CheckoutLink
    ) -> None:
        response = await client.get("/backoffice/checkout-links/?include_deleted=true")
        assert response.status_code == 200
        content = response.text
        # Should show both active and deleted checkout links
        assert str(checkout_link.id) in content
        assert str(deleted_checkout_link.id) in content

    async def test_search_by_label(
        self, client: AsyncClient, save_fixture: SaveFixture, product: Product
    ) -> None:
        # Create a checkout link with a specific label
        labeled_checkout_link = await create_checkout_link(
            save_fixture,
            products=[product],
            label="test-label-12345",
        )
        
        response = await client.get("/backoffice/checkout-links/?query=test-label-12345")
        assert response.status_code == 200
        content = response.text
        assert str(labeled_checkout_link.id) in content


@pytest.mark.asyncio
class TestGetCheckoutLink:
    async def test_get_active_checkout_link(
        self, client: AsyncClient, checkout_link: CheckoutLink
    ) -> None:
        response = await client.get(f"/backoffice/checkout-links/{checkout_link.id}")
        assert response.status_code == 200
        content = response.text
        assert str(checkout_link.id) in content
        assert str(checkout_link.client_secret) in content
        # Should NOT show restore button for active checkout links
        assert "Restore" not in content

    async def test_get_deleted_checkout_link(
        self, client: AsyncClient, deleted_checkout_link: CheckoutLink
    ) -> None:
        response = await client.get(f"/backoffice/checkout-links/{deleted_checkout_link.id}")
        assert response.status_code == 200
        content = response.text
        assert str(deleted_checkout_link.id) in content
        # Should show restore button for deleted checkout links
        assert "Restore" in content

    async def test_get_nonexistent_checkout_link(
        self, client: AsyncClient
    ) -> None:
        import uuid
        fake_id = uuid.uuid4()
        response = await client.get(f"/backoffice/checkout-links/{fake_id}")
        assert response.status_code == 404


@pytest.mark.asyncio
class TestRestoreCheckoutLink:
    async def test_restore_deleted_checkout_link(
        self, client: AsyncClient, deleted_checkout_link: CheckoutLink, session: AsyncSession
    ) -> None:
        # Restore the deleted checkout link
        response = await client.post(f"/backoffice/checkout-links/{deleted_checkout_link.id}/restore")
        # Should redirect to the checkout link details
        assert response.status_code == 302
        
        # Verify the checkout link is actually restored
        await session.refresh(deleted_checkout_link)
        assert deleted_checkout_link.deleted_at is None

    async def test_restore_active_checkout_link(
        self, client: AsyncClient, checkout_link: CheckoutLink
    ) -> None:
        # Trying to restore an already active checkout link should fail
        response = await client.post(f"/backoffice/checkout-links/{checkout_link.id}/restore")
        assert response.status_code == 400

    async def test_restore_nonexistent_checkout_link(
        self, client: AsyncClient
    ) -> None:
        import uuid
        fake_id = uuid.uuid4()
        response = await client.post(f"/backoffice/checkout-links/{fake_id}/restore")
        assert response.status_code == 404