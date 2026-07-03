from __future__ import annotations

import typing

from polar.base import (
    AsyncServiceBase,
    SyncServiceBase,
    parse_response_json,
    parse_response_none,
)
from polar.errors import (
    CheckEmailUpdate401Error,
    CustomerNotReady,
    HTTPValidationError,
    PaymentMethodInUseByActiveSubscription,
    PaymentMethodSetupFailed,
    ResourceNotFound,
    VerifyEmailUpdate401Error,
    VerifyEmailUpdate422Error,
)
from polar.inputs import (
    CustomerEmailUpdateRequest,
    CustomerEmailUpdateVerifyRequest,
    CustomerPaymentMethodConfirm,
    CustomerPaymentMethodCreate,
    CustomerPortalCustomerUpdate,
)
from polar.outputs import (
    CustomerEmailUpdateVerifyResponse,
    CustomerPaymentMethod,
    CustomerPaymentMethodCreateResponse,
    CustomerPortalCustomer,
    ListResourceCustomerPaymentMethod,
)


class CustomersSync(SyncServiceBase):
    def get(
        self,
    ) -> CustomerPortalCustomer:
        """
        Get authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:

        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/customers/me",
            path_params={},
            query_params={},
        )
        response = self.client.send_request(request)
        return parse_response_json(response, CustomerPortalCustomer)

    def update(
        self,
        **kwargs: typing.Unpack[CustomerPortalCustomerUpdate],
    ) -> CustomerPortalCustomer:
        """
        Update authenticated customer.

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customer-portal/customers/me",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerPortalCustomer, method_errors)

    def list_payment_methods(
        self,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceCustomerPaymentMethod:
        """
        Get saved payment methods of the authenticated customer.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/customers/me/payment-methods",
            path_params={},
            query_params={
                "page": page,
                "limit": limit,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, ListResourceCustomerPaymentMethod, method_errors
        )

    def iter_list_payment_methods(
        self,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> typing.Generator[CustomerPaymentMethod]:
        """
        Get saved payment methods of the authenticated customer.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            A generator that yields items of type CustomerPaymentMethod.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list_payment_methods(
                page=page,
                limit=limit,
            )
            yield from response.items
            if page == response.pagination.max_page:
                break
            page += 1

    def add_payment_method(
        self,
        **kwargs: typing.Unpack[CustomerPaymentMethodCreate],
    ) -> CustomerPaymentMethodCreateResponse:
        """
        Add a payment method to the authenticated customer.

        Args:
            **kwargs: Request body parameters

        Raises:
            PaymentMethodSetupFailed: The card was declined while setting up the payment method.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/customers/me/payment-methods",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: PaymentMethodSetupFailed,
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, CustomerPaymentMethodCreateResponse, method_errors
        )

    def confirm_payment_method(
        self,
        **kwargs: typing.Unpack[CustomerPaymentMethodConfirm],
    ) -> CustomerPaymentMethodCreateResponse:
        """
        Confirm a payment method for the authenticated customer.

        Args:
            **kwargs: Request body parameters

        Raises:
            CustomerNotReady: Customer is not ready to confirm a payment method.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/customers/me/payment-methods/confirm",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: CustomerNotReady,
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, CustomerPaymentMethodCreateResponse, method_errors
        )

    def delete_payment_method(
        self,
        id: str,
    ) -> None:
        """
        Delete a payment method from the authenticated customer.

        Args:
            id:

        Raises:
            PaymentMethodInUseByActiveSubscription: Payment method is used by active subscription(s).
            ResourceNotFound: Payment method not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customer-portal/customers/me/payment-methods/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            400: PaymentMethodInUseByActiveSubscription,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    def request_email_update(
        self,
        **kwargs: typing.Unpack[CustomerEmailUpdateRequest],
    ) -> typing.Any:
        """
        Request an email change for the authenticated customer.

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/customers/me/email-update/request",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, typing.Any, method_errors)

    def check_email_update(
        self,
        *,
        token: str,
    ) -> None:
        """
        Check if an email change verification token is still valid.

        Args:
            token:

        Raises:
            CheckEmailUpdate401Error: Invalid or expired verification token.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/customers/me/email-update/check",
            path_params={},
            query_params={
                "token": token,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            401: CheckEmailUpdate401Error,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    def verify_email_update(
        self,
        **kwargs: typing.Unpack[CustomerEmailUpdateVerifyRequest],
    ) -> CustomerEmailUpdateVerifyResponse:
        """
        Verify an email change using the token from the verification email.

        Args:
            **kwargs: Request body parameters

        Raises:
            VerifyEmailUpdate401Error: Invalid or expired verification token.
            VerifyEmailUpdate422Error: Email address is already in use.
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/customers/me/email-update/verify",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            401: VerifyEmailUpdate401Error,
            422: VerifyEmailUpdate422Error,
        }
        return parse_response_json(
            response, CustomerEmailUpdateVerifyResponse, method_errors
        )


class CustomersAsync(AsyncServiceBase):
    async def get(
        self,
    ) -> CustomerPortalCustomer:
        """
        Get authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:

        Raises:
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/customers/me",
            path_params={},
            query_params={},
        )
        response = await self.client.send_request(request)
        return parse_response_json(response, CustomerPortalCustomer)

    async def update(
        self,
        **kwargs: typing.Unpack[CustomerPortalCustomerUpdate],
    ) -> CustomerPortalCustomer:
        """
        Update authenticated customer.

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customer-portal/customers/me",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerPortalCustomer, method_errors)

    async def list_payment_methods(
        self,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceCustomerPaymentMethod:
        """
        Get saved payment methods of the authenticated customer.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/customers/me/payment-methods",
            path_params={},
            query_params={
                "page": page,
                "limit": limit,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, ListResourceCustomerPaymentMethod, method_errors
        )

    async def iter_list_payment_methods(
        self,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> typing.AsyncGenerator[CustomerPaymentMethod]:
        """
        Get saved payment methods of the authenticated customer.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            An async generator that yields items of type CustomerPaymentMethod.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list_payment_methods(
                page=page,
                limit=limit,
            )
            for item in response.items:
                yield item
            if page == response.pagination.max_page:
                break
            page += 1

    async def add_payment_method(
        self,
        **kwargs: typing.Unpack[CustomerPaymentMethodCreate],
    ) -> CustomerPaymentMethodCreateResponse:
        """
        Add a payment method to the authenticated customer.

        Args:
            **kwargs: Request body parameters

        Raises:
            PaymentMethodSetupFailed: The card was declined while setting up the payment method.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/customers/me/payment-methods",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: PaymentMethodSetupFailed,
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, CustomerPaymentMethodCreateResponse, method_errors
        )

    async def confirm_payment_method(
        self,
        **kwargs: typing.Unpack[CustomerPaymentMethodConfirm],
    ) -> CustomerPaymentMethodCreateResponse:
        """
        Confirm a payment method for the authenticated customer.

        Args:
            **kwargs: Request body parameters

        Raises:
            CustomerNotReady: Customer is not ready to confirm a payment method.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/customers/me/payment-methods/confirm",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: CustomerNotReady,
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, CustomerPaymentMethodCreateResponse, method_errors
        )

    async def delete_payment_method(
        self,
        id: str,
    ) -> None:
        """
        Delete a payment method from the authenticated customer.

        Args:
            id:

        Raises:
            PaymentMethodInUseByActiveSubscription: Payment method is used by active subscription(s).
            ResourceNotFound: Payment method not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customer-portal/customers/me/payment-methods/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: PaymentMethodInUseByActiveSubscription,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    async def request_email_update(
        self,
        **kwargs: typing.Unpack[CustomerEmailUpdateRequest],
    ) -> typing.Any:
        """
        Request an email change for the authenticated customer.

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/customers/me/email-update/request",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, typing.Any, method_errors)

    async def check_email_update(
        self,
        *,
        token: str,
    ) -> None:
        """
        Check if an email change verification token is still valid.

        Args:
            token:

        Raises:
            CheckEmailUpdate401Error: Invalid or expired verification token.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/customers/me/email-update/check",
            path_params={},
            query_params={
                "token": token,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: CheckEmailUpdate401Error,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    async def verify_email_update(
        self,
        **kwargs: typing.Unpack[CustomerEmailUpdateVerifyRequest],
    ) -> CustomerEmailUpdateVerifyResponse:
        """
        Verify an email change using the token from the verification email.

        Args:
            **kwargs: Request body parameters

        Raises:
            VerifyEmailUpdate401Error: Invalid or expired verification token.
            VerifyEmailUpdate422Error: Email address is already in use.
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/customers/me/email-update/verify",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: VerifyEmailUpdate401Error,
            422: VerifyEmailUpdate422Error,
        }
        return parse_response_json(
            response, CustomerEmailUpdateVerifyResponse, method_errors
        )
