import uuid
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.email.schemas import ChargebackPreventionRefundEmail
from polar.kit.currency import format_currency
from polar.models import Customer, Organization, Product, User
from polar.models.refund import RefundReason
from polar.models.user_organization import (
    OrganizationNotificationSettings,
    OrganizationRole,
    UserOrganization,
)
from polar.refund.tasks import send_chargeback_prevention_notice
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order_and_payment,
    create_refund,
    create_user,
)


@pytest.fixture(autouse=True)
def enqueue_email_template_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.refund.tasks.enqueue_email_template")


async def _add_member(
    save_fixture: SaveFixture,
    organization: Organization,
    user: User,
    role: OrganizationRole,
    notification_settings: OrganizationNotificationSettings | None = None,
) -> None:
    user_organization = UserOrganization(
        user_id=user.id,
        organization_id=organization.id,
        role=role,
    )
    if notification_settings is not None:
        user_organization.notification_settings = notification_settings
    await save_fixture(user_organization)


@pytest.mark.asyncio
class TestSendChargebackPreventionNotice:
    async def test_missing_refund_is_noop(
        self, enqueue_email_template_mock: MagicMock
    ) -> None:
        await send_chargeback_prevention_notice(uuid.uuid4())
        enqueue_email_template_mock.assert_not_called()

    async def test_fans_out_to_owner_and_admins_only(
        self,
        save_fixture: SaveFixture,
        enqueue_email_template_mock: MagicMock,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        owner = await create_user(save_fixture)
        admin = await create_user(save_fixture)
        member = await create_user(save_fixture)
        await _add_member(save_fixture, organization, owner, OrganizationRole.owner)
        await _add_member(save_fixture, organization, admin, OrganizationRole.admin)
        await _add_member(save_fixture, organization, member, OrganizationRole.member)

        order, payment, _ = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )
        refund = await create_refund(
            save_fixture,
            order,
            payment,
            amount=1000,
            tax_amount=250,
            reason=RefundReason.dispute_prevention,
        )

        await send_chargeback_prevention_notice(refund.id)

        recipients = {
            call.kwargs["to_email_addr"]
            for call in enqueue_email_template_mock.call_args_list
        }
        assert recipients == {owner.email, admin.email}
        assert member.email not in recipients
        assert enqueue_email_template_mock.call_count == 2

    async def test_no_admins_sends_nothing(
        self,
        save_fixture: SaveFixture,
        enqueue_email_template_mock: MagicMock,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        member = await create_user(save_fixture)
        await _add_member(save_fixture, organization, member, OrganizationRole.member)

        order, payment, _ = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )
        refund = await create_refund(
            save_fixture,
            order,
            payment,
            amount=1000,
            tax_amount=250,
            reason=RefundReason.dispute_prevention,
        )

        await send_chargeback_prevention_notice(refund.id)

        enqueue_email_template_mock.assert_not_called()

    async def test_email_props_and_subject(
        self,
        save_fixture: SaveFixture,
        enqueue_email_template_mock: MagicMock,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        owner = await create_user(save_fixture)
        await _add_member(save_fixture, organization, owner, OrganizationRole.owner)

        order, payment, _ = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )
        order.invoice_number = "POLAR-2026-00042"
        await save_fixture(order)

        refund = await create_refund(
            save_fixture,
            order,
            payment,
            amount=1000,
            tax_amount=250,
            reason=RefundReason.dispute_prevention,
        )

        await send_chargeback_prevention_notice(refund.id)

        enqueue_email_template_mock.assert_called_once()
        call = enqueue_email_template_mock.call_args
        email = call.args[0]
        assert isinstance(email, ChargebackPreventionRefundEmail)
        assert email.props.email == owner.email
        assert email.props.order_number == "POLAR-2026-00042"
        assert email.props.customer_name == customer.display_name
        assert email.props.amount == refund.total_amount
        assert email.props.formatted_amount == format_currency(
            refund.total_amount, refund.currency
        )
        assert call.kwargs["to_email_addr"] == owner.email
        assert (
            call.kwargs["subject"] == "Chargeback prevented for order POLAR-2026-00042"
        )

    async def test_order_number_falls_back_to_id(
        self,
        save_fixture: SaveFixture,
        enqueue_email_template_mock: MagicMock,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        owner = await create_user(save_fixture)
        await _add_member(save_fixture, organization, owner, OrganizationRole.owner)

        order, payment, _ = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )
        order.invoice_number = None
        await save_fixture(order)

        refund = await create_refund(
            save_fixture,
            order,
            payment,
            amount=1000,
            tax_amount=250,
            reason=RefundReason.dispute_prevention,
        )

        await send_chargeback_prevention_notice(refund.id)

        call = enqueue_email_template_mock.call_args
        assert call.args[0].props.order_number == str(order.id)
        assert call.kwargs["subject"] == f"Chargeback prevented for order {order.id}"

    async def test_skips_members_who_opted_out(
        self,
        save_fixture: SaveFixture,
        enqueue_email_template_mock: MagicMock,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        owner = await create_user(save_fixture)
        await _add_member(
            save_fixture,
            organization,
            owner,
            OrganizationRole.owner,
            notification_settings=OrganizationNotificationSettings(
                new_order=True,
                new_subscription=True,
                chargeback_prevention=False,
            ),
        )

        order, payment, _ = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )
        refund = await create_refund(
            save_fixture,
            order,
            payment,
            amount=1000,
            tax_amount=250,
            reason=RefundReason.dispute_prevention,
        )

        await send_chargeback_prevention_notice(refund.id)

        enqueue_email_template_mock.assert_not_called()

    async def test_respects_per_member_opt_out(
        self,
        save_fixture: SaveFixture,
        enqueue_email_template_mock: MagicMock,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        opted_out_owner = await create_user(save_fixture)
        opted_in_admin = await create_user(save_fixture)
        await _add_member(
            save_fixture,
            organization,
            opted_out_owner,
            OrganizationRole.owner,
            notification_settings=OrganizationNotificationSettings(
                new_order=True,
                new_subscription=True,
                chargeback_prevention=False,
            ),
        )
        await _add_member(
            save_fixture,
            organization,
            opted_in_admin,
            OrganizationRole.admin,
            notification_settings=OrganizationNotificationSettings(
                new_order=True,
                new_subscription=True,
                chargeback_prevention=True,
            ),
        )

        order, payment, _ = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subtotal_amount=1000,
            tax_amount=250,
        )
        refund = await create_refund(
            save_fixture,
            order,
            payment,
            amount=1000,
            tax_amount=250,
            reason=RefundReason.dispute_prevention,
        )

        await send_chargeback_prevention_notice(refund.id)

        recipients = {
            call.kwargs["to_email_addr"]
            for call in enqueue_email_template_mock.call_args_list
        }
        assert recipients == {opted_in_admin.email}
        assert opted_out_owner.email not in recipients
