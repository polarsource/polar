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
export class Finalize402Error extends PolarClientError<
  PaymentFailedModel | PaymentActionRequiredModel
> {
  constructor(
    public readonly statusCode: 402,
    public readonly error: PaymentFailedModel | PaymentActionRequiredModel,
  ) {
    super(statusCode, error);
    this.name = "Finalize402Error";
  }
}
/**
 * Off-session charges are not enabled for this organization, or its account can't currently accept payments.
 */
export class Finalize403Error extends PolarClientError<
  OffSessionChargesNotEnabledModel | OrganizationNotReadyForPaymentsModel
> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: OffSessionChargesNotEnabledModel | OrganizationNotReadyForPaymentsModel,
  ) {
    super(statusCode, error);
    this.name = "Finalize403Error";
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
export class Update403Error extends PolarClientError<CheckoutForbiddenErrorModel> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: CheckoutForbiddenErrorModel,
  ) {
    super(statusCode, error);
    this.name = "Update403Error";
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
export class ClientUpdate403Error extends PolarClientError<CheckoutForbiddenErrorModel> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: CheckoutForbiddenErrorModel,
  ) {
    super(statusCode, error);
    this.name = "ClientUpdate403Error";
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
export class ClientConfirm403Error extends PolarClientError<CheckoutForbiddenErrorModel> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: CheckoutForbiddenErrorModel,
  ) {
    super(statusCode, error);
    this.name = "ClientConfirm403Error";
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
export class CheckEmailUpdate401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "CheckEmailUpdate401Error";
  }
}
/**
 * Invalid or expired verification token.
 */
export class VerifyEmailUpdate401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "VerifyEmailUpdate401Error";
  }
}
/**
 * Email address is already in use.
 */
export class VerifyEmailUpdate422Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 422,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "VerifyEmailUpdate422Error";
  }
}
/**
 * Authentication required
 */
export class ListSeats401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "ListSeats401Error";
  }
}
/**
 * Not permitted or seat-based pricing not enabled
 */
export class ListSeats403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "ListSeats403Error";
  }
}
/**
 * Subscription or order not found
 */
export class ListSeats404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "ListSeats404Error";
  }
}
/**
 * No available seats or customer already has a seat
 */
export class AssignSeat400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "AssignSeat400Error";
  }
}
/**
 * Authentication required
 */
export class AssignSeat401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "AssignSeat401Error";
  }
}
/**
 * Not permitted or seat-based pricing not enabled
 */
export class AssignSeat403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "AssignSeat403Error";
  }
}
/**
 * Subscription, order, or customer not found
 */
export class AssignSeat404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "AssignSeat404Error";
  }
}
/**
 * Authentication required
 */
export class RevokeSeat401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "RevokeSeat401Error";
  }
}
/**
 * Not permitted or seat-based pricing not enabled
 */
export class RevokeSeat403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "RevokeSeat403Error";
  }
}
/**
 * Seat not found
 */
export class RevokeSeat404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "RevokeSeat404Error";
  }
}
/**
 * Seat is not pending or already claimed
 */
export class ResendInvitation400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "ResendInvitation400Error";
  }
}
/**
 * Authentication required
 */
export class ResendInvitation401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "ResendInvitation401Error";
  }
}
/**
 * Not permitted or seat-based pricing not enabled
 */
export class ResendInvitation403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "ResendInvitation403Error";
  }
}
/**
 * Seat not found
 */
export class ResendInvitation404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "ResendInvitation404Error";
  }
}
/**
 * Authentication required
 */
export class ListClaimedSubscriptions401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "ListClaimedSubscriptions401Error";
  }
}
/**
 * Authentication required
 */
export class ListMembers401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "ListMembers401Error";
  }
}
/**
 * Not permitted - requires owner or billing manager role
 */
export class ListMembers403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "ListMembers403Error";
  }
}
/**
 * Invalid request or member already exists.
 */
export class AddMember400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "AddMember400Error";
  }
}
/**
 * Authentication required
 */
export class AddMember401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "AddMember401Error";
  }
}
/**
 * Not permitted - requires owner or billing manager role
 */
export class AddMember403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "AddMember403Error";
  }
}
/**
 * Cannot remove the only owner.
 */
export class RemoveMember400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "RemoveMember400Error";
  }
}
/**
 * Authentication required
 */
export class RemoveMember401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "RemoveMember401Error";
  }
}
/**
 * Not permitted - requires owner or billing manager role
 */
export class RemoveMember403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "RemoveMember403Error";
  }
}
/**
 * Member not found.
 */
export class RemoveMember404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "RemoveMember404Error";
  }
}
/**
 * Invalid role change.
 */
export class UpdateMember400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "UpdateMember400Error";
  }
}
/**
 * Authentication required
 */
export class UpdateMember401Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 401,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "UpdateMember401Error";
  }
}
/**
 * Not permitted - requires owner or billing manager role
 */
export class UpdateMember403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "UpdateMember403Error";
  }
}
/**
 * Member not found.
 */
export class UpdateMember404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "UpdateMember404Error";
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
 * Invalid or expired invitation token
 */
export class GetClaimInfo400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "GetClaimInfo400Error";
  }
}
/**
 * Seat-based pricing not enabled for organization
 */
export class GetClaimInfo403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "GetClaimInfo403Error";
  }
}
/**
 * Seat not found
 */
export class GetClaimInfo404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "GetClaimInfo404Error";
  }
}
/**
 * Invalid, expired, or already claimed token
 */
export class ClaimSeat400Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 400,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "ClaimSeat400Error";
  }
}
/**
 * Seat-based pricing not enabled for organization
 */
export class ClaimSeat403Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 403,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "ClaimSeat403Error";
  }
}
/**
 * Not Found
 */
export class Update404Error extends PolarClientError<null> {
  constructor(
    public readonly statusCode: 404,
    public readonly error: null,
  ) {
    super(statusCode, error);
    this.name = "Update404Error";
  }
}
