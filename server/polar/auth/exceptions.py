from typing import Literal

from pydantic import BaseModel, Field, create_model

from polar.config import settings
from polar.exceptions import PolarError


class PolarAuthError(PolarError):
    """
    Base exception class for authentication errors.
    """


class UnavailableFactorError(PolarAuthError):
    """
    Exception raised when a requested authentication factor is unavailable for the
    given authentication session.
    """

    def __init__(self, factor: str) -> None:
        self.factor = factor
        message = "The requested authentication factor is not available for this authentication session"
        super().__init__(message, 403)


class SessionNotFreshError(PolarAuthError):
    """
    Exception raised when an operation requires a recently authenticated session.
    """

    def __init__(self) -> None:
        message = (
            "This action requires a recently authenticated session. "
            "Please sign in again."
        )
        super().__init__(message, 403)


class InvalidRequestedOrganization(PolarAuthError):
    """
    Exception raised when the ``Polar-Organization`` header is malformed.
    """

    def __init__(self, message: str) -> None:
        super().__init__(message, 400)


class RequestedOrganizationNotAccessible(PolarAuthError):
    """
    Exception raised when the ``Polar-Organization`` header names an organization
    the credential can't access.
    """

    def __init__(self) -> None:
        message = (
            "The organization in the Polar-Organization header "
            "is not accessible with this credential."
        )
        super().__init__(message, 403)


class SSORequired(PolarAuthError):
    """
    Exception raised when the email belongs to a domain whose organization
    enforces SSO.
    """

    def __init__(self, redirect_url: str) -> None:
        self.redirect_url = redirect_url
        message = "This email domain signs in through single sign-on."
        super().__init__(message, 409)

    @classmethod
    def schema(cls) -> type[BaseModel]:
        if cls._schema is None:
            cls._schema = create_model(
                cls.__name__,
                error=(Literal["SSORequired"], Field(examples=[cls.__name__])),
                detail=(str, ...),
                redirect_url=(str, ...),
            )
        return cls._schema


class GetEmailError(PolarAuthError):
    """
    Exception raised when there's an error getting the email from an OAuth2 provider.
    """

    def __init__(self) -> None:
        message = "An error occurred while retrieving your email from the authentication provider. Please try again."
        super().__init__(message, 400)


class PolarAuthRedirectionError(PolarError):
    """
    Exception class for authentication errors
    that should be displayed nicely to the user through our UI.

    Args:
        message (str): The error message to display to the user.
        url (str, optional): The path to redirect to in the client app. Defaults to "/auth".
        **extra: Additional keyword arguments that'll be added as query parameters to the redirection URL.

    A specific exception handler will redirect to the specified path in the client app
    with the provided error message.
    """

    def __init__(
        self,
        message: str,
        url: str = settings.generate_frontend_url("/auth"),
        **extra: str,
    ) -> None:
        super().__init__(message, status_code=303)
        self.url = url
        self.extra = extra
