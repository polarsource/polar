from collections.abc import Sequence
from typing import Any, ClassVar, Literal, LiteralString, NotRequired, TypedDict

from pydantic import BaseModel, Field, create_model
from pydantic_core import ErrorDetails, InitErrorDetails, PydanticCustomError
from pydantic_core import ValidationError as PydanticValidationError

from polar.config import settings


class PolarError(Exception):
    """
    Base exception class for all errors raised by Polar.

    A custom exception handler for FastAPI takes care
    of catching and returning a proper HTTP error from them.

    Args:
        message: The error message that'll be displayed to the user.
        status_code: The status code of the HTTP response. Defaults to 500.
        headers: Additional headers to be included in the response.
    """

    _schema: ClassVar[type[BaseModel] | None] = None

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.headers = headers

    @classmethod
    def schema(cls) -> type[BaseModel]:
        if cls._schema is not None:
            return cls._schema

        error_literal = Literal[cls.__name__]  # type: ignore

        model = create_model(
            cls.__name__,
            error=(error_literal, Field(examples=[cls.__name__])),
            detail=(str, ...),
        )
        cls._schema = model
        return cls._schema


class PolarTaskError(PolarError):
    """
    Base exception class for errors raised by tasks.

    Args:
        message: The error message.
    """

    def __init__(self, message: str) -> None:
        super().__init__(message)


class PolarRedirectionError(PolarError):
    """
    Exception class for errors
    that should be displayed nicely to the user through our UI.

    A specific exception handler will redirect to `/error` page in the client app.

    Args:
        return_to: Target URL of the *Go back* button on the error page.
    """

    def __init__(
        self, message: str, status_code: int = 400, return_to: str | None = None
    ) -> None:
        self.return_to = return_to
        super().__init__(message, status_code)


class BadRequest(PolarError):
    def __init__(self, message: str = "Bad request", status_code: int = 400) -> None:
        super().__init__(message, status_code)


class NotPermitted(PolarError):
    def __init__(self, message: str = "Not permitted", status_code: int = 403) -> None:
        super().__init__(message, status_code)


class Unauthorized(PolarError):
    def __init__(self, message: str = "Unauthorized", status_code: int = 401) -> None:
        super().__init__(
            message,
            status_code,
            headers={
                "WWW-Authenticate": f'Bearer realm="{settings.WWW_AUTHENTICATE_REALM}"'
            },
        )


class InternalServerError(PolarError):
    def __init__(
        self, message: str = "Internal Server Error", status_code: int = 500
    ) -> None:
        super().__init__(message, status_code)


class ResourceNotFound(PolarError):
    def __init__(self, message: str = "Not found", status_code: int = 404) -> None:
        super().__init__(message, status_code)


class ResourceNotModified(Exception):
    # Handled separately to avoid any content being returned
    """304 Not Modified."""

    def __init__(self) -> None:
        self.status_code = 304


class ResourceUnavailable(PolarError):
    def __init__(self, message: str = "Unavailable", status_code: int = 410) -> None:
        super().__init__(message, status_code)


class ResourceAlreadyExists(PolarError):
    def __init__(self, message: str = "Already exists", status_code: int = 409) -> None:
        super().__init__(message, status_code)


class PaymentNotReady(PolarError):
    def __init__(
        self,
        message: str = "Organization is not ready to accept payments",
        status_code: int = 403,
    ) -> None:
        super().__init__(message, status_code)


class ValidationError(TypedDict):
    loc: tuple[int | str, ...]
    msg: LiteralString
    type: LiteralString
    input: Any
    ctx: NotRequired[dict[str, Any]]
    url: NotRequired[str]


class PolarRequestValidationError(PolarError):
    def __init__(self, errors: Sequence[ValidationError]) -> None:
        self._errors = errors

    def errors(self) -> list[ErrorDetails]:
        pydantic_errors: list[InitErrorDetails] = []
        for error in self._errors:
            pydantic_errors.append(
                {
                    "type": PydanticCustomError(error["type"], error["msg"]),
                    "loc": error["loc"],
                    "input": error["input"],
                }
            )
        pydantic_error = PydanticValidationError.from_exception_data(
            self.__class__.__name__, pydantic_errors
        )
        return pydantic_error.errors()
