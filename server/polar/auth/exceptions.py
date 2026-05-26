from polar.exceptions import PolarError


class PolarAuthError(PolarError):
    """
    Base exception class for authentication errors.
    """

    pass


class GetEmailError(PolarAuthError):
    """
    Exception raised when there's an error getting the email from an OAuth2 provider.
    """

    def __init__(self) -> None:
        message = "An error occurred while retrieving your email from the authentication provider. Please try again."
        super().__init__(message)


class PolarAuthRedirectionError(PolarError):
    """
    Exception class for authentication errors
    that should be displayed nicely to the user through our UI.

    A specific exception handler will redirect to `/auth` page in the client app
    with an error message.
    """
