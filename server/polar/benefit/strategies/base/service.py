from typing import Any, Protocol, cast

from polar.auth.models import AuthSubject
from polar.exceptions import PolarError, PolarRequestValidationError, ValidationError
from polar.models import Benefit, Customer, Organization, User
from polar.postgres import AsyncSession
from polar.redis import Redis

from .properties import BenefitGrantProperties, BenefitProperties


class BenefitServiceError(PolarError): ...


class BenefitPropertiesValidationError(PolarRequestValidationError):
    """
    Benefit properties validation error.
    """

    def __init__(self, errors: list[ValidationError]) -> None:
        errors = [
            {
                "loc": ("body", "properties", *error["loc"]),
                "msg": error["msg"],
                "type": error["type"],
                "input": error["input"],
            }
            for error in errors
        ]
        super().__init__(errors)


class BenefitRetriableError(BenefitServiceError):
    """
    A retriable error occured while granting or revoking the benefit.
    """

    defer_seconds: int | None
    "Number of seconds to wait before retrying. If None, worker defaults will be used."

    def __init__(self, defer_seconds: int | None = None) -> None:
        self.defer_seconds = defer_seconds
        message = "An error occured while granting or revoking the benefit."
        super().__init__(message)

    @property
    def defer_milliseconds(self) -> int | None:
        """
        Number of milliseconds to wait before retrying.
        """
        return self.defer_seconds * 1000 if self.defer_seconds else None


class BenefitActionRequiredError(BenefitServiceError):
    """
    An action is required from the customer before granting the benefit.

    Typically, we need the customer to connect an external OAuth account.
    """


class BenefitServiceProtocol[BP: BenefitProperties, BGP: BenefitGrantProperties](
    Protocol
):
    """
    Protocol that should be implemented by each benefit type service.

    It allows to implement very customizable and specific logic to fulfill the benefit.
    """

    session: AsyncSession
    redis: Redis

    should_revoke_individually: bool = False

    def __init__(self, session: AsyncSession, redis: Redis) -> None:
        self.session = session
        self.redis = redis

    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BGP,
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> BGP:
        """
        Executes the logic to grant a benefit to a customer.

        Args:
            benefit: The Benefit to grant.
            customer: The customer.
            grant_properties: Stored properties for this specific benefit and customer.
            Might be available at this stage if we're updating
            an already granted benefit.
            update: Whether we are updating an already granted benefit.
            attempt: Number of times we attempted to grant the benefit.
            Useful for the worker to implement retry logic.

        Returns:
            A dictionary with data to store for this specific benefit and customer.
            For example, it can be useful to store external identifiers
            that may help when updating the grant or revoking it.
            **Existing properties will be overriden, so be sure to include all the data
            you want to keep.**

        Raises:
            BenefitRetriableError: An temporary error occured,
            we should be able to retry later.
        """
        ...

    async def cycle(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BGP,
        *,
        attempt: int = 1,
    ) -> BGP:
        """
        Executes the logic when a subscription is renewed for a new cycle for a granted benefit.

        Args:
            benefit: The granted Benefit.
            customer: The customer.
            grant_properties: Stored properties for this specific benefit and customer.
            attempt: Number of times we attempted to grant the benefit.
            Useful for the worker to implement retry logic.

        Returns:
            A dictionary with data to store for this specific benefit and customer.
            For example, it can be useful to store external identifiers
            that may help when updating the grant or revoking it.
            **Existing properties will be overriden, so be sure to include all the data
            you want to keep.**

        Raises:
            BenefitRetriableError: An temporary error occured,
            we should be able to retry later.
        """
        ...

    async def revoke(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BGP,
        *,
        attempt: int = 1,
    ) -> BGP:
        """
        Executes the logic to revoke a benefit from a customer.

        Args:
            benefit: The Benefit to revoke.
            customer: The customer.
            grant_properties: Stored properties for this specific benefit and customer.
            attempt: Number of times we attempted to revoke the benefit.
            Useful for the worker to implement retry logic.

        Returns:
            A dictionary with data to store for this specific benefit and customer.
            For example, it can be useful to store external identifiers
            that may help when updating the grant or revoking it.
            **Existing properties will be overriden, so be sure to include all the data
            you want to keep.**

        Raises:
            BenefitRetriableError: An temporary error occured,
            we should be able to retry later.
        """
        ...

    async def requires_update(self, benefit: Benefit, previous_properties: BP) -> bool:
        """
        Determines if a benefit update requires to trigger the granting logic again.

        This method is called whenever a benefit is updated. If it returns `True`, the
        granting logic will be re-executed again for all the backers, i.e. the `grant`
        method will be called with the `update` argument set to `True`.

        Args:
            benefit: The updated Benefit.
            previous_properties: The Benefit properties before the update.
            Use it to check which fields have been updated.
        """
        ...

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BP:
        """
        Validates the benefit properties before creation.

        Useful if we need to call external logic to make sure this input is valid.

        Args:
            user: The User creating the benefit.
            properties: The input properties to validate.

        Returns:
            The validated Benefit properties.
            It can be different from the input if needed.

        Raises:
            BenefitPropertiesValidationError: The benefit
            properties are invalid.
        """
        ...

    def _get_properties(self, benefit: Benefit) -> BP:
        """
        Returns the Benefit properties.

        Args:
            benefit: The benefit.

        Returns:
            The benefit properties.
        """
        return cast(BP, benefit.properties)
