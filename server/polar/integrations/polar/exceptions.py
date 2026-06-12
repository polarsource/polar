import uuid

from polar.exceptions import PolarError


class PolarSelfWebhookError(PolarError): ...


class TransactionFeeBenefitError(PolarSelfWebhookError): ...


class SupportBenefitError(PolarSelfWebhookError): ...


class PolarSelfNotConfigured(PolarError):
    def __init__(self) -> None:
        super().__init__("Polar self-billing is not configured.", status_code=404)


class PolarSelfPlanNotFound(PolarError):
    def __init__(self, product_id: str) -> None:
        super().__init__(f"Plan {product_id!r} is not available.", status_code=404)
        self.product_id = product_id


class PolarSelfNoActiveSubscription(PolarError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        super().__init__(
            f"Organization {organization_id} has no active subscription.",
            status_code=404,
        )
        self.organization_id = organization_id


class PolarSelfOrderNotFound(PolarError):
    def __init__(self, order_id: str) -> None:
        super().__init__(f"Order {order_id!r} not found.", status_code=404)
        self.order_id = order_id


class PolarSelfCustomerNotFound(PolarError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        super().__init__(
            f"Organization {organization_id} has no Polar customer.",
            status_code=404,
        )
        self.organization_id = organization_id


class PolarSelfPaymentMethodNotFound(PolarError):
    def __init__(self, payment_method_id: str) -> None:
        super().__init__(
            f"Payment method {payment_method_id!r} not found.",
            status_code=404,
        )
        self.payment_method_id = payment_method_id


class PolarSelfBenefitGrantNotFound(PolarError):
    def __init__(self, benefit_grant_id: str) -> None:
        super().__init__(
            f"Benefit grant {benefit_grant_id!r} not found.",
            status_code=404,
        )
        self.benefit_grant_id = benefit_grant_id


class PolarSelfPaymentMethodInUse(PolarError):
    def __init__(self, payment_method_id: str) -> None:
        super().__init__(
            "This payment method is used by an active subscription and "
            "no alternative payment method is available. Add another "
            "payment method before deleting this one.",
            status_code=400,
        )
        self.payment_method_id = payment_method_id


class PolarSelfNotApproved(PolarError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        super().__init__(
            "Your organization must complete review and be approved "
            "before changing plan.",
            status_code=403,
        )
        self.organization_id = organization_id


class PolarSelfInvoiceNotReady(PolarSelfWebhookError):
    def __init__(self, order_id: str) -> None:
        super().__init__(f"Invoice for order {order_id!r} not yet generated.")
        self.order_id = order_id


class PolarSelfNotPaidOrder(PolarSelfWebhookError):
    def __init__(self, order_id: str) -> None:
        super().__init__(f"Order {order_id!r} is not paid yet.")
        self.order_id = order_id
