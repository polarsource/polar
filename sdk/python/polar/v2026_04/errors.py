from __future__ import annotations

from polar.base import PolarClientError
from polar.v2026_04.outputs import (
    AlreadyCanceledSubscription as AlreadyCanceledSubscriptionModel,
)
from polar.v2026_04.outputs import (
    AmbiguousExternalCustomerID as AmbiguousExternalCustomerIDModel,
)
from polar.v2026_04.outputs import (
    CannotCreateOrganizationError as CannotCreateOrganizationErrorModel,
)
from polar.v2026_04.outputs import (
    CheckoutForbiddenError as CheckoutForbiddenErrorModel,
)
from polar.v2026_04.outputs import (
    CustomerNotReady as CustomerNotReadyModel,
)
from polar.v2026_04.outputs import (
    DisputeNotOpenError as DisputeNotOpenErrorModel,
)
from polar.v2026_04.outputs import (
    ExpiredCheckoutError as ExpiredCheckoutErrorModel,
)
from polar.v2026_04.outputs import (
    HTTPValidationError as HTTPValidationErrorModel,
)
from polar.v2026_04.outputs import (
    ManualRetryLimitExceeded as ManualRetryLimitExceededModel,
)
from polar.v2026_04.outputs import (
    MissingInvoiceBillingDetails as MissingInvoiceBillingDetailsModel,
)
from polar.v2026_04.outputs import (
    NotPermitted as NotPermittedModel,
)
from polar.v2026_04.outputs import (
    OffSessionChargesNotEnabled as OffSessionChargesNotEnabledModel,
)
from polar.v2026_04.outputs import (
    OrderNotDraft as OrderNotDraftModel,
)
from polar.v2026_04.outputs import (
    OrderNotEligibleForInvoice as OrderNotEligibleForInvoiceModel,
)
from polar.v2026_04.outputs import (
    OrderNotEligibleForRetry as OrderNotEligibleForRetryModel,
)
from polar.v2026_04.outputs import (
    OrganizationNotReadyForPayments as OrganizationNotReadyForPaymentsModel,
)
from polar.v2026_04.outputs import (
    PauseResumeNotAllowed as PauseResumeNotAllowedModel,
)
from polar.v2026_04.outputs import (
    PaymentActionRequired as PaymentActionRequiredModel,
)
from polar.v2026_04.outputs import (
    PaymentAlreadyInProgress as PaymentAlreadyInProgressModel,
)
from polar.v2026_04.outputs import (
    PaymentError as PaymentErrorModel,
)
from polar.v2026_04.outputs import (
    PaymentFailed as PaymentFailedModel,
)
from polar.v2026_04.outputs import (
    PaymentMethodInUseByActiveSubscription as PaymentMethodInUseByActiveSubscriptionModel,
)
from polar.v2026_04.outputs import (
    PaymentMethodSetupFailed as PaymentMethodSetupFailedModel,
)
from polar.v2026_04.outputs import (
    RefundedAlready as RefundedAlreadyModel,
)
from polar.v2026_04.outputs import (
    ResourceNotFound as ResourceNotFoundModel,
)
from polar.v2026_04.outputs import (
    SSOEnforcementRequiresConnection as SSOEnforcementRequiresConnectionModel,
)
from polar.v2026_04.outputs import (
    SubscriptionLocked as SubscriptionLockedModel,
)
from polar.v2026_04.outputs import (
    Unauthorized as UnauthorizedModel,
)


class HTTPValidationError(PolarClientError):
    error_type = HTTPValidationErrorModel
    error: HTTPValidationErrorModel

    def __init__(self, status_code: int, error: HTTPValidationErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class CannotCreateOrganizationError(PolarClientError):
    error_type = CannotCreateOrganizationErrorModel
    error: CannotCreateOrganizationErrorModel

    def __init__(
        self, status_code: int, error: CannotCreateOrganizationErrorModel
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class ResourceNotFound(PolarClientError):
    error_type = ResourceNotFoundModel
    error: ResourceNotFoundModel

    def __init__(self, status_code: int, error: ResourceNotFoundModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class NotPermitted(PolarClientError):
    error_type = NotPermittedModel
    error: NotPermittedModel

    def __init__(self, status_code: int, error: NotPermittedModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class SSOEnforcementRequiresConnection(PolarClientError):
    error_type = SSOEnforcementRequiresConnectionModel
    error: SSOEnforcementRequiresConnectionModel

    def __init__(
        self, status_code: int, error: SSOEnforcementRequiresConnectionModel
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class AlreadyCanceledSubscription(PolarClientError):
    error_type = AlreadyCanceledSubscriptionModel
    error: AlreadyCanceledSubscriptionModel

    def __init__(
        self, status_code: int, error: AlreadyCanceledSubscriptionModel
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class SubscriptionLocked(PolarClientError):
    error_type = SubscriptionLockedModel
    error: SubscriptionLockedModel

    def __init__(self, status_code: int, error: SubscriptionLockedModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class PaymentFailed(PolarClientError):
    error_type = PaymentFailedModel
    error: PaymentFailedModel

    def __init__(self, status_code: int, error: PaymentFailedModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class OrdersFinalize402Error(PolarClientError):
    error_type = PaymentFailedModel | PaymentActionRequiredModel
    error: PaymentFailedModel | PaymentActionRequiredModel

    def __init__(
        self, status_code: int, error: PaymentFailedModel | PaymentActionRequiredModel
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class OrdersFinalize403Error(PolarClientError):
    error_type = OffSessionChargesNotEnabledModel | OrganizationNotReadyForPaymentsModel
    error: OffSessionChargesNotEnabledModel | OrganizationNotReadyForPaymentsModel

    def __init__(
        self,
        status_code: int,
        error: OffSessionChargesNotEnabledModel | OrganizationNotReadyForPaymentsModel,
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class OrderNotDraft(PolarClientError):
    error_type = OrderNotDraftModel
    error: OrderNotDraftModel

    def __init__(self, status_code: int, error: OrderNotDraftModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class OrderNotEligibleForInvoice(PolarClientError):
    error_type = OrderNotEligibleForInvoiceModel
    error: OrderNotEligibleForInvoiceModel

    def __init__(
        self, status_code: int, error: OrderNotEligibleForInvoiceModel
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class MissingInvoiceBillingDetails(PolarClientError):
    error_type = MissingInvoiceBillingDetailsModel
    error: MissingInvoiceBillingDetailsModel

    def __init__(
        self, status_code: int, error: MissingInvoiceBillingDetailsModel
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class RefundedAlready(PolarClientError):
    error_type = RefundedAlreadyModel
    error: RefundedAlreadyModel

    def __init__(self, status_code: int, error: RefundedAlreadyModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class DisputeNotOpenError(PolarClientError):
    error_type = DisputeNotOpenErrorModel
    error: DisputeNotOpenErrorModel

    def __init__(self, status_code: int, error: DisputeNotOpenErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class CheckoutsUpdate403Error(PolarClientError):
    error_type = CheckoutForbiddenErrorModel
    error: CheckoutForbiddenErrorModel

    def __init__(self, status_code: int, error: CheckoutForbiddenErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class ExpiredCheckoutError(PolarClientError):
    error_type = ExpiredCheckoutErrorModel
    error: ExpiredCheckoutErrorModel

    def __init__(self, status_code: int, error: ExpiredCheckoutErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class CheckoutsClientUpdate403Error(PolarClientError):
    error_type = CheckoutForbiddenErrorModel
    error: CheckoutForbiddenErrorModel

    def __init__(self, status_code: int, error: CheckoutForbiddenErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class PaymentError(PolarClientError):
    error_type = PaymentErrorModel
    error: PaymentErrorModel

    def __init__(self, status_code: int, error: PaymentErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class CheckoutsClientConfirm403Error(PolarClientError):
    error_type = CheckoutForbiddenErrorModel
    error: CheckoutForbiddenErrorModel

    def __init__(self, status_code: int, error: CheckoutForbiddenErrorModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class Unauthorized(PolarClientError):
    error_type = UnauthorizedModel
    error: UnauthorizedModel

    def __init__(self, status_code: int, error: UnauthorizedModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class AmbiguousExternalCustomerID(PolarClientError):
    error_type = AmbiguousExternalCustomerIDModel
    error: AmbiguousExternalCustomerIDModel

    def __init__(
        self, status_code: int, error: AmbiguousExternalCustomerIDModel
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class PaymentMethodSetupFailed(PolarClientError):
    error_type = PaymentMethodSetupFailedModel
    error: PaymentMethodSetupFailedModel

    def __init__(self, status_code: int, error: PaymentMethodSetupFailedModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerNotReady(PolarClientError):
    error_type = CustomerNotReadyModel
    error: CustomerNotReadyModel

    def __init__(self, status_code: int, error: CustomerNotReadyModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class PaymentMethodInUseByActiveSubscription(PolarClientError):
    error_type = PaymentMethodInUseByActiveSubscriptionModel
    error: PaymentMethodInUseByActiveSubscriptionModel

    def __init__(
        self, status_code: int, error: PaymentMethodInUseByActiveSubscriptionModel
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomersCheckEmailUpdate401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomersVerifyEmailUpdate401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomersVerifyEmailUpdate422Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsListSeats401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsListSeats403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsListSeats404Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsAssignSeat400Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsAssignSeat401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsAssignSeat403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsAssignSeat404Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsRevokeSeat401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsRevokeSeat403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsRevokeSeat404Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsResendInvitation400Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsResendInvitation401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsResendInvitation403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsResendInvitation404Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class SeatsListClaimedSubscriptions401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersListMembers401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersListMembers403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersAddMember400Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersAddMember401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersAddMember403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersRemoveMember400Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersRemoveMember401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersRemoveMember403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersRemoveMember404Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersUpdateMember400Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersUpdateMember401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersUpdateMember403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class MembersUpdateMember404Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class PaymentAlreadyInProgress(PolarClientError):
    error_type = PaymentAlreadyInProgressModel
    error: PaymentAlreadyInProgressModel

    def __init__(self, status_code: int, error: PaymentAlreadyInProgressModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class OrderNotEligibleForRetry(PolarClientError):
    error_type = OrderNotEligibleForRetryModel
    error: OrderNotEligibleForRetryModel

    def __init__(self, status_code: int, error: OrderNotEligibleForRetryModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class ManualRetryLimitExceeded(PolarClientError):
    error_type = ManualRetryLimitExceededModel
    error: ManualRetryLimitExceededModel

    def __init__(self, status_code: int, error: ManualRetryLimitExceededModel) -> None:
        self.error = error
        super().__init__(status_code, error)


class SubscriptionsUpdate403Error(PolarClientError):
    error_type = AlreadyCanceledSubscriptionModel | PauseResumeNotAllowedModel
    error: AlreadyCanceledSubscriptionModel | PauseResumeNotAllowedModel

    def __init__(
        self,
        status_code: int,
        error: AlreadyCanceledSubscriptionModel | PauseResumeNotAllowedModel,
    ) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsListSeats401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsListSeats403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsListSeats404Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsAssignSeat400Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsAssignSeat401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsAssignSeat403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsAssignSeat404Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsRevokeSeat401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsRevokeSeat403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsRevokeSeat404Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsResendInvitation400Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsResendInvitation401Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsResendInvitation403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsResendInvitation404Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsGetClaimInfo400Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsGetClaimInfo403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsGetClaimInfo404Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsClaimSeat400Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class CustomerSeatsClaimSeat403Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)


class EventTypesUpdate404Error(PolarClientError):
    error_type = None
    error: None

    def __init__(self, status_code: int, error: None) -> None:
        self.error = error
        super().__init__(status_code, error)
