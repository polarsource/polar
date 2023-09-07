from sqlalchemy import exc as sqlalchemy

IntegrityError = sqlalchemy.IntegrityError


class PolarError(Exception):
    """
    Base exception class for all errors raised by Polar.

    A custom exception handler for FastAPI takes care
    of catching and returning a proper HTTP error from them.

    Args:
        message: The error message that'll be displayed to the user.
        status_code: The status code of the HTTP response. Defaults to 400.
    """

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotPermitted(PolarError):
    def __init__(self, message: str = "Not permitted", status_code: int = 403) -> None:
        super().__init__(message, status_code)


class Unauthorized(PolarError):
    def __init__(self, message: str = "Unauthorized", status_code: int = 401) -> None:
        super().__init__(message, status_code)


class StripeError(PolarError):
    ...


class ResourceNotFound(PolarError):
    def __init__(self, message: str = "Not found", status_code: int = 404) -> None:
        super().__init__(message, status_code)
