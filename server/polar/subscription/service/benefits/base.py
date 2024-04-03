from typing import Any, LiteralString, Protocol, TypedDict, TypeVar

from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from pydantic_core import InitErrorDetails, PydanticCustomError

from polar.exceptions import PolarError
from polar.models import (
    Subscription,
    SubscriptionBenefit,
    User,
)
from polar.models.subscription_benefit import SubscriptionBenefitProperties
from polar.notifications.notification import (
    SubscriptionBenefitPreconditionErrorNotificationContextualPayload,
)
from polar.postgres import AsyncSession


class SubscriptionBenefitServiceError(PolarError): ...


class SubscriptionBenefitPropertyValidationError(TypedDict):
    type: LiteralString
    message: LiteralString
    loc: tuple[int | str, ...]
    input: Any


class SubscriptionBenefitPropertiesValidationError(SubscriptionBenefitServiceError):
    """
    Subscription properties validation error.
    """

    errors: list[SubscriptionBenefitPropertyValidationError]
    """List of errors."""

    def __init__(
        self, errors: list[SubscriptionBenefitPropertyValidationError]
    ) -> None:
        self.errors = errors
        message = "Subscription benefit properties are invalid."
        super().__init__(message, 422)

    def to_request_validation_error(
        self, loc_prefix: tuple[str | int, ...]
    ) -> RequestValidationError:
        pydantic_errors: list[InitErrorDetails] = []
        for error in self.errors:
            pydantic_errors.append(
                {
                    "type": PydanticCustomError(error["type"], error["message"]),
                    "loc": (*loc_prefix, "properties", *error["loc"]),
                    "input": error["input"],
                }
            )
        pydantic_error = ValidationError.from_exception_data(
            self.__class__.__name__, pydantic_errors
        )
        return RequestValidationError(pydantic_error.errors())


class SubscriptionBenefitRetriableError(SubscriptionBenefitServiceError):
    """
    A retriable error occured while granting or revoking the benefit.
    """

    defer_seconds: int
    "Number of seconds to wait before retrying."

    def __init__(self, defer_seconds: int) -> None:
        self.defer_seconds = defer_seconds
        message = f"An error occured. We'll retry in {defer_seconds} seconds."
        super().__init__(message)


class SubscriptionBenefitPreconditionError(SubscriptionBenefitServiceError):
    """
    Some conditions are missing to grant the benefit.

    It accepts a payload schema.
    When set, a notification will be sent to the backer to explain them what happened.
    """

    def __init__(
        self,
        message: str,
        *,
        payload: SubscriptionBenefitPreconditionErrorNotificationContextualPayload
        | None = None,
    ) -> None:
        """
        Args:
            message: The plain error message.
            payload: The payload to build the notification.
        """
        self.payload = payload
        super().__init__(message)


SB = TypeVar("SB", bound=SubscriptionBenefit, contravariant=True)
SBP = TypeVar("SBP", bound=SubscriptionBenefitProperties)


class SubscriptionBenefitServiceProtocol(Protocol[SB, SBP]):
    """
    Protocol that should be implemented by each benefit type service.

    It allows to implement very customizable and specific logic to fulfill the benefit.
    """

    session: AsyncSession

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def grant(
        self,
        benefit: SB,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        """
        Executes the logic to grant a benefit to a backer.

        Args:
            benefit: The SubscriptionBenefit to grant.
            subscription: The Subscription we should grant this benefit to.
            user: The backer user.
            grant_properties: Stored properties for this specific benefit and user.
            Might be available at this stage if we're updating
            an already granted benefit.
            update: Whether we are updating an already granted benefit.
            attempt: Number of times we attempted to grant the benefit.
            Useful for the worker to implement retry logic.

        Returns:
            A dictionary with data to store for this specific benefit and user.
            For example, it can be useful to store external identifiers
            that may help when updating the grant or revoking it.
            **Existing properties will be overriden, so be sure to include all the data
            you want to keep.**

        Raises:
            SubscriptionBenefitRetriableError: An temporary error occured,
            we should be able to retry later.
            SubscriptionBenefitPreconditionError: Some conditions are missing
            to grant the benefit.
        """
        ...

    async def revoke(
        self,
        benefit: SB,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        """
        Executes the logic to revoke a benefit from a backer.

        Args:
            benefit: The SubscriptionBenefit to revoke.
            subscription: The Subscription we should revoke this benefit from.
            user: The backer user.
            grant_properties: Stored properties for this specific benefit and user.
            attempt: Number of times we attempted to revoke the benefit.
            Useful for the worker to implement retry logic.

        Returns:
            A dictionary with data to store for this specific benefit and user.
            For example, it can be useful to store external identifiers
            that may help when updating the grant or revoking it.
            **Existing properties will be overriden, so be sure to include all the data
            you want to keep.**

        Raises:
            SubscriptionBenefitRetriableError: An temporary error occured,
            we should be able to retry later.
        """
        ...

    async def requires_update(self, benefit: SB, previous_properties: SBP) -> bool:
        """
        Determines if a benefit update requires to trigger the granting logic again.

        This method is called whenever a benefit is updated. If it returns `True`, the
        granting logic will be re-executed again for all the backers, i.e. the `grant`
        method will be called with the `update` argument set to `True`.

        Args:
            benefit: The updated SubscriptionBenefit.
            previous_properties: The SubscriptionBenefit properties before the update.
            Use it to check which fields have been updated.
        """
        ...

    async def validate_properties(self, user: User, properties: dict[str, Any]) -> SBP:
        """
        Validates the benefit properties before creation.

        Useful if we need to call external logic to make sure this input is valid.

        Args:
            user: The User creating the benefit.
            properties: The input properties to validate.

        Returns:
            The validated SubscriptionBenefit properties.
            It can be different from the input if needed.

        Raises:
            SubscriptionBenefitPropertiesValidationError: The subscription benefit
            properties are invalid.
        """
        ...
