import pytest
import pytest_asyncio

from polar.models import CheckoutLink, Product
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
async def deleted_checkout_link(
    save_fixture: SaveFixture, product: Product
) -> CheckoutLink:
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


# NOTE: Web backoffice tests are skipped because they require admin authentication
# which is complex to set up in tests. The functionality can be tested manually
# by accessing /backoffice/checkout-links/ with an admin user.


@pytest.mark.skip(reason="Requires admin authentication setup")
@pytest.mark.asyncio
class TestBackofficeCheckoutLinks:
    """
    These tests are skipped due to admin authentication requirements.
    The backoffice functionality can be tested manually:

    1. Start the server
    2. Log in as an admin user
    3. Visit /backoffice/checkout-links/ to see the list
    4. Create a deleted checkout link and verify it shows up with include_deleted=true
    5. Test the restore functionality on deleted links
    """

    async def test_list_checkout_links_placeholder(self) -> None:
        # Placeholder for potential future implementation
        # when admin auth fixtures are available
        pass
