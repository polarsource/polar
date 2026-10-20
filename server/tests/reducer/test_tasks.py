import uuid

import pytest
from pytest_mock import MockerFixture

from polar.models import Customer
from polar.reducer.service import reducer as reducer_service
from polar.reducer.tasks import CustomerDoesNotExist, compare_customer_state


@pytest.mark.anyio
class TestCompareCustomerState:
    async def test_customer_does_not_exist(self) -> None:
        with pytest.raises(CustomerDoesNotExist):
            await compare_customer_state(uuid.uuid4())

    async def test_compares_fresh_state(
        self, mocker: MockerFixture, customer: Customer
    ) -> None:
        log_customer_state_comparison = mocker.patch.object(
            reducer_service, "log_customer_state_comparison"
        )

        await compare_customer_state(customer.id)

        [(_, _, compared_customer, state)] = [
            call.args for call in log_customer_state_comparison.call_args_list
        ]
        assert compared_customer.id == customer.id
        assert state.id == customer.id
