from polar.config import settings
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
        super().__init__(message, status_code=302)
        self.url = url
        self.extra = extra
