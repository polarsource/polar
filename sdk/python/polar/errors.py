from __future__ import annotations

import typing

from polar.base import PolarErrorResponse
from polar.outputs import (
    AlreadyCanceledSubscription as AlreadyCanceledSubscriptionModel,
)
from polar.outputs import (
    CheckoutForbiddenError as CheckoutForbiddenErrorModel,
)
from polar.outputs import (
    CustomerNotReady as CustomerNotReadyModel,
)
from polar.outputs import (
    ExpiredCheckoutError as ExpiredCheckoutErrorModel,
)
from polar.outputs import (
    HTTPValidationError as HTTPValidationErrorModel,
)
from polar.outputs import (
    ManualRetryLimitExceeded as ManualRetryLimitExceededModel,
)
from polar.outputs import (
    MissingInvoiceBillingDetails as MissingInvoiceBillingDetailsModel,
)
from polar.outputs import (
    NotPaidOrder as NotPaidOrderModel,
)
from polar.outputs import (
    NotPermitted as NotPermittedModel,
)
from polar.outputs import (
    OffSessionChargesNotEnabled as OffSessionChargesNotEnabledModel,
)
from polar.outputs import (
    OrderNotDraft as OrderNotDraftModel,
)
from polar.outputs import (
    OrderNotEligibleForRetry as OrderNotEligibleForRetryModel,
)
from polar.outputs import (
    OrganizationNotReadyForPayments as OrganizationNotReadyForPaymentsModel,
)
from polar.outputs import (
    PaymentActionRequired as PaymentActionRequiredModel,
)
from polar.outputs import (
    PaymentAlreadyInProgress as PaymentAlreadyInProgressModel,
)
from polar.outputs import (
    PaymentError as PaymentErrorModel,
)
from polar.outputs import (
    PaymentFailed as PaymentFailedModel,
)
from polar.outputs import (
    PaymentMethodInUseByActiveSubscription as PaymentMethodInUseByActiveSubscriptionModel,
)
from polar.outputs import (
    PaymentMethodSetupFailed as PaymentMethodSetupFailedModel,
)
from polar.outputs import (
    RefundedAlready as RefundedAlreadyModel,
)
from polar.outputs import (
    ResourceNotFound as ResourceNotFoundModel,
)
from polar.outputs import (
    SubscriptionLocked as SubscriptionLockedModel,
)
from polar.outputs import (
    Unauthorized as UnauthorizedModel,
)


class HTTPValidationError(PolarErrorResponse):
    error_type = HTTPValidationErrorModel
    error: HTTPValidationErrorModel

    def __init__(self, status_code: int, error: HTTPValidationErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class ResourceNotFound(PolarErrorResponse):
    error_type = ResourceNotFoundModel
    error: ResourceNotFoundModel

    def __init__(self, status_code: int, error: ResourceNotFoundModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class NotPermitted(PolarErrorResponse):
    error_type = NotPermittedModel
    error: NotPermittedModel

    def __init__(self, status_code: int, error: NotPermittedModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class AlreadyCanceledSubscription(PolarErrorResponse):
    error_type = AlreadyCanceledSubscriptionModel
    error: AlreadyCanceledSubscriptionModel

    def __init__(
        self, status_code: int, error: AlreadyCanceledSubscriptionModel
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class SubscriptionLocked(PolarErrorResponse):
    error_type = SubscriptionLockedModel
    error: SubscriptionLockedModel

    def __init__(self, status_code: int, error: SubscriptionLockedModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class PaymentFailed(PolarErrorResponse):
    error_type = PaymentFailedModel
    error: PaymentFailedModel

    def __init__(self, status_code: int, error: PaymentFailedModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class Finalize402Error(PolarErrorResponse):
    error_type = PaymentFailedModel | PaymentActionRequiredModel
    error: PaymentFailedModel | PaymentActionRequiredModel

    def __init__(
        self, status_code: int, error: PaymentFailedModel | PaymentActionRequiredModel
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class Finalize403Error(PolarErrorResponse):
    error_type = OffSessionChargesNotEnabledModel | OrganizationNotReadyForPaymentsModel
    error: OffSessionChargesNotEnabledModel | OrganizationNotReadyForPaymentsModel

    def __init__(
        self,
        status_code: int,
        error: OffSessionChargesNotEnabledModel | OrganizationNotReadyForPaymentsModel,
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class OrderNotDraft(PolarErrorResponse):
    error_type = OrderNotDraftModel
    error: OrderNotDraftModel

    def __init__(self, status_code: int, error: OrderNotDraftModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class GenerateInvoice422Error(PolarErrorResponse):
    error_type = MissingInvoiceBillingDetailsModel | NotPaidOrderModel
    error: MissingInvoiceBillingDetailsModel | NotPaidOrderModel

    def __init__(
        self,
        status_code: int,
        error: MissingInvoiceBillingDetailsModel | NotPaidOrderModel,
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class RefundedAlready(PolarErrorResponse):
    error_type = RefundedAlreadyModel
    error: RefundedAlreadyModel

    def __init__(self, status_code: int, error: RefundedAlreadyModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class Update403Error(PolarErrorResponse):
    error_type = CheckoutForbiddenErrorModel
    error: CheckoutForbiddenErrorModel

    def __init__(self, status_code: int, error: CheckoutForbiddenErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class ExpiredCheckoutError(PolarErrorResponse):
    error_type = ExpiredCheckoutErrorModel
    error: ExpiredCheckoutErrorModel

    def __init__(self, status_code: int, error: ExpiredCheckoutErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class ClientUpdate403Error(PolarErrorResponse):
    error_type = CheckoutForbiddenErrorModel
    error: CheckoutForbiddenErrorModel

    def __init__(self, status_code: int, error: CheckoutForbiddenErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class PaymentError(PolarErrorResponse):
    error_type = PaymentErrorModel
    error: PaymentErrorModel

    def __init__(self, status_code: int, error: PaymentErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class ClientConfirm403Error(PolarErrorResponse):
    error_type = CheckoutForbiddenErrorModel
    error: CheckoutForbiddenErrorModel

    def __init__(self, status_code: int, error: CheckoutForbiddenErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class Unauthorized(PolarErrorResponse):
    error_type = UnauthorizedModel
    error: UnauthorizedModel

    def __init__(self, status_code: int, error: UnauthorizedModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class CreateMember403Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class PaymentMethodSetupFailed(PolarErrorResponse):
    error_type = PaymentMethodSetupFailedModel
    error: PaymentMethodSetupFailedModel

    def __init__(self, status_code: int, error: PaymentMethodSetupFailedModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerNotReady(PolarErrorResponse):
    error_type = CustomerNotReadyModel
    error: CustomerNotReadyModel

    def __init__(self, status_code: int, error: CustomerNotReadyModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class PaymentMethodInUseByActiveSubscription(PolarErrorResponse):
    error_type = PaymentMethodInUseByActiveSubscriptionModel
    error: PaymentMethodInUseByActiveSubscriptionModel

    def __init__(
        self, status_code: int, error: PaymentMethodInUseByActiveSubscriptionModel
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class CheckEmailUpdate401Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class VerifyEmailUpdate401Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class VerifyEmailUpdate422Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class ListSeats401Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class ListSeats403Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class ListSeats404Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class AssignSeat400Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class AssignSeat401Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class AssignSeat403Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class AssignSeat404Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class RevokeSeat401Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class RevokeSeat403Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class RevokeSeat404Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class ResendInvitation400Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class ResendInvitation401Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class ResendInvitation403Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class ResendInvitation404Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class ListClaimedSubscriptions401Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class ListMembers401Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class ListMembers403Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class AddMember400Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class AddMember401Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class AddMember403Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class RemoveMember400Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class RemoveMember401Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class RemoveMember403Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class RemoveMember404Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class UpdateMember400Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class UpdateMember401Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class UpdateMember403Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class UpdateMember404Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class PaymentAlreadyInProgress(PolarErrorResponse):
    error_type = PaymentAlreadyInProgressModel
    error: PaymentAlreadyInProgressModel

    def __init__(self, status_code: int, error: PaymentAlreadyInProgressModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class OrderNotEligibleForRetry(PolarErrorResponse):
    error_type = OrderNotEligibleForRetryModel
    error: OrderNotEligibleForRetryModel

    def __init__(self, status_code: int, error: OrderNotEligibleForRetryModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class ManualRetryLimitExceeded(PolarErrorResponse):
    error_type = ManualRetryLimitExceededModel
    error: ManualRetryLimitExceededModel

    def __init__(self, status_code: int, error: ManualRetryLimitExceededModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class GetClaimInfo400Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class GetClaimInfo403Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class GetClaimInfo404Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class ClaimSeat400Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class ClaimSeat403Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)


class Update404Error(PolarErrorResponse):
    error_type = typing.Any
    error: typing.Any

    def __init__(self, status_code: int, error: typing.Any) -> None:
        self.error = error
        super().__init__(status_code, error)
