import type {
  AlreadyCanceledSubscription as AlreadyCanceledSubscriptionModel,
  AmbiguousExternalCustomerID as AmbiguousExternalCustomerIDModel,
  CannotCreateOrganizationError as CannotCreateOrganizationErrorModel,
  CheckoutForbiddenError as CheckoutForbiddenErrorModel,
  CustomerNotReady as CustomerNotReadyModel,
  DisputeNotOpenError as DisputeNotOpenErrorModel,
  ExpiredCheckoutError as ExpiredCheckoutErrorModel,
  HTTPValidationError as HTTPValidationErrorModel,
  ManualRetryLimitExceeded as ManualRetryLimitExceededModel,
  MissingInvoiceBillingDetails as MissingInvoiceBillingDetailsModel,
  NotPermitted as NotPermittedModel,
  OffSessionChargesNotEnabled as OffSessionChargesNotEnabledModel,
  OrderNotDraft as OrderNotDraftModel,
  OrderNotEligibleForInvoice as OrderNotEligibleForInvoiceModel,
  OrderNotEligibleForRetry as OrderNotEligibleForRetryModel,
  OrganizationNotReadyForPayments as OrganizationNotReadyForPaymentsModel,
  PauseResumeNotAllowed as PauseResumeNotAllowedModel,
  PaymentActionRequired as PaymentActionRequiredModel,
  PaymentAlreadyInProgress as PaymentAlreadyInProgressModel,
  PaymentError as PaymentErrorModel,
  PaymentFailed as PaymentFailedModel,
  PaymentMethodInUseByActiveSubscription as PaymentMethodInUseByActiveSubscriptionModel,
  PaymentMethodSetupFailed as PaymentMethodSetupFailedModel,
  RefundedAlready as RefundedAlreadyModel,
  ResourceNotFound as ResourceNotFoundModel,
  SSOEnforcementRequiresConnection as SSOEnforcementRequiresConnectionModel,
  SubscriptionLocked as SubscriptionLockedModel,
  Unauthorized as UnauthorizedModel,
} from "./models";

import { PolarClientError } from "../base";
/**
 * Validation Error
 */
export class HTTPValidationError extends PolarClientError<HTTPValidationErrorModel> {
  constructor(
    public readonly statusCode: 422,
    public readonly error: HTTPValidationErrorModel,
  ) {
    super(statusCode, error);
    this.name = "HTTPValidationError";
  }
}
/**
 * Forbidden
 */
export class CannotCreateOrganizationError extends PolarClientError<CannotCreateOrganizationErrorModel> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: CannotCreateOrganizationErrorModel,
  ) {
    super(statusCode, error);
    this.name = "CannotCreateOrganizationError";
  }
}
/**
 * Organization not found.
 */
export class ResourceNotFound extends PolarClientError<ResourceNotFoundModel> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: ResourceNotFoundModel,
  ) {
    super(statusCode, error);
    this.name = "ResourceNotFound";
  }
}
/**
 * You don't have the permission to update this organization.
 */
export class NotPermitted extends PolarClientError<NotPermittedModel> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: NotPermittedModel,
  ) {
    super(statusCode, error);
    this.name = "NotPermitted";
  }
}
/**
 * Cannot enforce SSO without an enabled connection.
 */
export class SSOEnforcementRequiresConnection extends PolarClientError<SSOEnforcementRequiresConnectionModel> {
  constructor(
    public readonly statusCode: 409,
    public readonly error: SSOEnforcementRequiresConnectionModel,
  ) {
    super(statusCode, error);
    this.name = "SSOEnforcementRequiresConnection";
  }
}
/**
 * This subscription is already revoked.
 */
export class AlreadyCanceledSubscription extends PolarClientError<AlreadyCanceledSubscriptionModel> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: AlreadyCanceledSubscriptionModel,
  ) {
    super(statusCode, error);
    this.name = "AlreadyCanceledSubscription";
  }
}
/**
 * Subscription is pending an update.
 */
export class SubscriptionLocked extends PolarClientError<SubscriptionLockedModel> {
  constructor(
    public readonly statusCode: 409,
    public readonly error: SubscriptionLockedModel,
  ) {
    super(statusCode, error);
    this.name = "SubscriptionLocked";
  }
}
/**
 * Payment required to apply the subscription update.
 */
export class PaymentFailed extends PolarClientError<PaymentFailedModel> {
  constructor(
    public readonly statusCode: 402,
    public readonly error: PaymentFailedModel,
  ) {
    super(statusCode, error);
    this.name = "PaymentFailed";
  }
}
/**
 * The charge failed, or requires customer authentication (e.g. a 3DS challenge) that can't be completed off-session.
 */
export class OrdersFinalize402Error extends PolarClientError<
  PaymentFailedModel | PaymentActionRequiredModel
> {
  constructor(
    public readonly statusCode: 402,
    public readonly error: PaymentFailedModel | PaymentActionRequiredModel,
  ) {
    super(statusCode, error);
    this.name = "OrdersFinalize402Error";
  }
}
/**
 * Off-session charges are not enabled for this organization, or its account can't currently accept payments.
 */
export class OrdersFinalize403Error extends PolarClientError<
  OffSessionChargesNotEnabledModel | OrganizationNotReadyForPaymentsModel
> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: OffSessionChargesNotEnabledModel | OrganizationNotReadyForPaymentsModel,
  ) {
    super(statusCode, error);
    this.name = "OrdersFinalize403Error";
  }
}
/**
 * The order is not in `draft` status.
 */
export class OrderNotDraft extends PolarClientError<OrderNotDraftModel> {
  constructor(
    public readonly statusCode: 412,
    public readonly error: OrderNotDraftModel,
  ) {
    super(statusCode, error);
    this.name = "OrderNotDraft";
  }
}
/**
 * Order is not eligible for invoice generation (invalid status).
 */
export class OrderNotEligibleForInvoice extends PolarClientError<OrderNotEligibleForInvoiceModel> {
  constructor(
    public readonly statusCode: 409,
    public readonly error: OrderNotEligibleForInvoiceModel,
  ) {
    super(statusCode, error);
    this.name = "OrderNotEligibleForInvoice";
  }
}
/**
 * Order is missing billing name or address.
 */
export class MissingInvoiceBillingDetails extends PolarClientError<MissingInvoiceBillingDetailsModel> {
  constructor(
    public readonly statusCode: 422,
    public readonly error: MissingInvoiceBillingDetailsModel,
  ) {
    super(statusCode, error);
    this.name = "MissingInvoiceBillingDetails";
  }
}
/**
 * Order is already fully refunded.
 */
export class RefundedAlready extends PolarClientError<RefundedAlreadyModel> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: RefundedAlreadyModel,
  ) {
    super(statusCode, error);
    this.name = "RefundedAlready";
  }
}
/**
 * Conflict
 */
export class DisputeNotOpenError extends PolarClientError<DisputeNotOpenErrorModel> {
  constructor(
    public readonly statusCode: 409,
    public readonly error: DisputeNotOpenErrorModel,
  ) {
    super(statusCode, error);
    this.name = "DisputeNotOpenError";
  }
}
/**
 * The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
 */
export class CheckoutsUpdate403Error extends PolarClientError<CheckoutForbiddenErrorModel> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: CheckoutForbiddenErrorModel,
  ) {
    super(statusCode, error);
    this.name = "CheckoutsUpdate403Error";
  }
}
/**
 * The checkout session is expired.
 */
export class ExpiredCheckoutError extends PolarClientError<ExpiredCheckoutErrorModel> {
  constructor(
    public readonly statusCode: 410,
    public readonly error: ExpiredCheckoutErrorModel,
  ) {
    super(statusCode, error);
    this.name = "ExpiredCheckoutError";
  }
}
/**
 * The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
 */
export class CheckoutsClientUpdate403Error extends PolarClientError<CheckoutForbiddenErrorModel> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: CheckoutForbiddenErrorModel,
  ) {
    super(statusCode, error);
    this.name = "CheckoutsClientUpdate403Error";
  }
}
/**
 * The payment failed.
 */
export class PaymentError extends PolarClientError<PaymentErrorModel> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: PaymentErrorModel,
  ) {
    super(statusCode, error);
    this.name = "PaymentError";
  }
}
/**
 * The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.
 */
export class CheckoutsClientConfirm403Error extends PolarClientError<CheckoutForbiddenErrorModel> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: CheckoutForbiddenErrorModel,
  ) {
    super(statusCode, error);
    this.name = "CheckoutsClientConfirm403Error";
  }
}
/**
 * Not authorized to manage license key.
 */
export class Unauthorized extends PolarClientError<UnauthorizedModel> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: UnauthorizedModel,
  ) {
    super(statusCode, error);
    this.name = "Unauthorized";
  }
}
/**
 * The external customer ID matches customers in several accessible organizations.
 */
export class AmbiguousExternalCustomerID extends PolarClientError<AmbiguousExternalCustomerIDModel> {
  constructor(
    public readonly statusCode: 409,
    public readonly error: AmbiguousExternalCustomerIDModel,
  ) {
    super(statusCode, error);
    this.name = "AmbiguousExternalCustomerID";
  }
}
/**
 * The card was declined while setting up the payment method.
 */
export class PaymentMethodSetupFailed extends PolarClientError<PaymentMethodSetupFailedModel> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: PaymentMethodSetupFailedModel,
  ) {
    super(statusCode, error);
    this.name = "PaymentMethodSetupFailed";
  }
}
/**
 * Customer is not ready to confirm a payment method.
 */
export class CustomerNotReady extends PolarClientError<CustomerNotReadyModel> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: CustomerNotReadyModel,
  ) {
    super(statusCode, error);
    this.name = "CustomerNotReady";
  }
}
/**
 * Payment method is used by active subscription(s).
 */
export class PaymentMethodInUseByActiveSubscription extends PolarClientError<PaymentMethodInUseByActiveSubscriptionModel> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: PaymentMethodInUseByActiveSubscriptionModel,
  ) {
    super(statusCode, error);
    this.name = "PaymentMethodInUseByActiveSubscription";
  }
}
/**
 * Invalid or expired verification token.
 */
export class CustomersCheckEmailUpdate401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomersCheckEmailUpdate401Error";
  }
}
/**
 * Invalid or expired verification token.
 */
export class CustomersVerifyEmailUpdate401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomersVerifyEmailUpdate401Error";
  }
}
/**
 * Email address is already in use.
 */
export class CustomersVerifyEmailUpdate422Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 422,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomersVerifyEmailUpdate422Error";
  }
}
/**
 * Authentication required
 */
export class SeatsListSeats401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsListSeats401Error";
  }
}
/**
 * Not permitted or seat-based pricing not enabled
 */
export class SeatsListSeats403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsListSeats403Error";
  }
}
/**
 * Subscription or order not found
 */
export class SeatsListSeats404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsListSeats404Error";
  }
}
/**
 * No available seats or customer already has a seat
 */
export class SeatsAssignSeat400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsAssignSeat400Error";
  }
}
/**
 * Authentication required
 */
export class SeatsAssignSeat401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsAssignSeat401Error";
  }
}
/**
 * Not permitted or seat-based pricing not enabled
 */
export class SeatsAssignSeat403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsAssignSeat403Error";
  }
}
/**
 * Subscription, order, or customer not found
 */
export class SeatsAssignSeat404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsAssignSeat404Error";
  }
}
/**
 * Authentication required
 */
export class SeatsRevokeSeat401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsRevokeSeat401Error";
  }
}
/**
 * Not permitted or seat-based pricing not enabled
 */
export class SeatsRevokeSeat403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsRevokeSeat403Error";
  }
}
/**
 * Seat not found
 */
export class SeatsRevokeSeat404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsRevokeSeat404Error";
  }
}
/**
 * Seat is not pending or already claimed
 */
export class SeatsResendInvitation400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsResendInvitation400Error";
  }
}
/**
 * Authentication required
 */
export class SeatsResendInvitation401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsResendInvitation401Error";
  }
}
/**
 * Not permitted or seat-based pricing not enabled
 */
export class SeatsResendInvitation403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsResendInvitation403Error";
  }
}
/**
 * Seat not found
 */
export class SeatsResendInvitation404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsResendInvitation404Error";
  }
}
/**
 * Authentication required
 */
export class SeatsListClaimedSubscriptions401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "SeatsListClaimedSubscriptions401Error";
  }
}
/**
 * Authentication required
 */
export class MembersListMembers401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersListMembers401Error";
  }
}
/**
 * Not permitted - requires owner or billing manager role
 */
export class MembersListMembers403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersListMembers403Error";
  }
}
/**
 * Invalid request or member already exists.
 */
export class MembersAddMember400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersAddMember400Error";
  }
}
/**
 * Authentication required
 */
export class MembersAddMember401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersAddMember401Error";
  }
}
/**
 * Not permitted - requires owner or billing manager role
 */
export class MembersAddMember403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersAddMember403Error";
  }
}
/**
 * Cannot remove the only owner.
 */
export class MembersRemoveMember400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersRemoveMember400Error";
  }
}
/**
 * Authentication required
 */
export class MembersRemoveMember401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersRemoveMember401Error";
  }
}
/**
 * Not permitted - requires owner or billing manager role
 */
export class MembersRemoveMember403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersRemoveMember403Error";
  }
}
/**
 * Member not found.
 */
export class MembersRemoveMember404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersRemoveMember404Error";
  }
}
/**
 * Invalid role change.
 */
export class MembersUpdateMember400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersUpdateMember400Error";
  }
}
/**
 * Authentication required
 */
export class MembersUpdateMember401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersUpdateMember401Error";
  }
}
/**
 * Not permitted - requires owner or billing manager role
 */
export class MembersUpdateMember403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersUpdateMember403Error";
  }
}
/**
 * Member not found.
 */
export class MembersUpdateMember404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "MembersUpdateMember404Error";
  }
}
/**
 * Payment already in progress.
 */
export class PaymentAlreadyInProgress extends PolarClientError<PaymentAlreadyInProgressModel> {
  constructor(
    public readonly statusCode: 409,
    public readonly error: PaymentAlreadyInProgressModel,
  ) {
    super(statusCode, error);
    this.name = "PaymentAlreadyInProgress";
  }
}
/**
 * Order not eligible for retry or payment confirmation failed.
 */
export class OrderNotEligibleForRetry extends PolarClientError<OrderNotEligibleForRetryModel> {
  constructor(
    public readonly statusCode: 422,
    public readonly error: OrderNotEligibleForRetryModel,
  ) {
    super(statusCode, error);
    this.name = "OrderNotEligibleForRetry";
  }
}
/**
 * Manual retry limit exceeded.
 */
export class ManualRetryLimitExceeded extends PolarClientError<ManualRetryLimitExceededModel> {
  constructor(
    public readonly statusCode: 429,
    public readonly error: ManualRetryLimitExceededModel,
  ) {
    super(statusCode, error);
    this.name = "ManualRetryLimitExceeded";
  }
}
/**
 * Customer subscription is already canceled or will be at the end of the period, the user lacks billing permissions, or pausing/resuming is not enabled for the organization.
 */
export class SubscriptionsUpdate403Error extends PolarClientError<
  AlreadyCanceledSubscriptionModel | PauseResumeNotAllowedModel
> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: AlreadyCanceledSubscriptionModel | PauseResumeNotAllowedModel,
  ) {
    super(statusCode, error);
    this.name = "SubscriptionsUpdate403Error";
  }
}
/**
 * Authentication required
 */
export class CustomerSeatsListSeats401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsListSeats401Error";
  }
}
/**
 * Not permitted or seat-based pricing not enabled
 */
export class CustomerSeatsListSeats403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsListSeats403Error";
  }
}
/**
 * Subscription or order not found
 */
export class CustomerSeatsListSeats404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsListSeats404Error";
  }
}
/**
 * No available seats or customer already has a seat
 */
export class CustomerSeatsAssignSeat400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsAssignSeat400Error";
  }
}
/**
 * Authentication required
 */
export class CustomerSeatsAssignSeat401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsAssignSeat401Error";
  }
}
/**
 * Not permitted or seat-based pricing not enabled
 */
export class CustomerSeatsAssignSeat403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsAssignSeat403Error";
  }
}
/**
 * Subscription, order, or customer not found
 */
export class CustomerSeatsAssignSeat404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsAssignSeat404Error";
  }
}
/**
 * Authentication required
 */
export class CustomerSeatsRevokeSeat401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsRevokeSeat401Error";
  }
}
/**
 * Not permitted or seat-based pricing not enabled
 */
export class CustomerSeatsRevokeSeat403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsRevokeSeat403Error";
  }
}
/**
 * Seat not found
 */
export class CustomerSeatsRevokeSeat404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsRevokeSeat404Error";
  }
}
/**
 * Seat is not pending or already claimed
 */
export class CustomerSeatsResendInvitation400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsResendInvitation400Error";
  }
}
/**
 * Authentication required
 */
export class CustomerSeatsResendInvitation401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsResendInvitation401Error";
  }
}
/**
 * Not permitted or seat-based pricing not enabled
 */
export class CustomerSeatsResendInvitation403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsResendInvitation403Error";
  }
}
/**
 * Seat not found
 */
export class CustomerSeatsResendInvitation404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsResendInvitation404Error";
  }
}
/**
 * Invalid or expired invitation token
 */
export class CustomerSeatsGetClaimInfo400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsGetClaimInfo400Error";
  }
}
/**
 * Seat-based pricing not enabled for organization
 */
export class CustomerSeatsGetClaimInfo403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsGetClaimInfo403Error";
  }
}
/**
 * Seat not found
 */
export class CustomerSeatsGetClaimInfo404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsGetClaimInfo404Error";
  }
}
/**
 * Invalid, expired, or already claimed token
 */
export class CustomerSeatsClaimSeat400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsClaimSeat400Error";
  }
}
/**
 * Seat-based pricing not enabled for organization
 */
export class CustomerSeatsClaimSeat403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CustomerSeatsClaimSeat403Error";
  }
}
/**
 * Not Found
 */
export class EventTypesUpdate404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "EventTypesUpdate404Error";
  }
}
