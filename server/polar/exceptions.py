from typing import Any, Literal, LiteralString, TypedDict

from pydantic import BaseModel, create_model
from pydantic_core import ErrorDetails, InitErrorDetails, PydanticCustomError
from pydantic_core import ValidationError as PydanticValidationError


class PolarError(Exception):
    """
    Base exception class for all errors raised by Polar.

    A custom exception handler for FastAPI takes care
    of catching and returning a proper HTTP error from them.

    Args:
        message: The error message that'll be displayed to the user.
        status_code: The status code of the HTTP response. Defaults to 500.
    """

    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code

    @classmethod
    def schema(cls) -> type[BaseModel]:
        type_literal = Literal[cls.__name__]  # type: ignore

        return create_model(cls.__name__, type=(type_literal, ...), detail=(str, ...))


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
        super().__init__(message, status_code)


class InternalServerError(PolarError):
    def __init__(
        self, message: str = "Internal Server Error", status_code: int = 500
    ) -> None:
        super().__init__(message, status_code)


class ResourceNotFound(PolarError):
    def __init__(self, message: str = "Not found", status_code: int = 404) -> None:
        super().__init__(message, status_code)


class ResourceUnavailable(PolarError):
    def __init__(self, message: str = "Unavailable", status_code: int = 410) -> None:
        super().__init__(message, status_code)


class ResourceAlreadyExists(PolarError):
    def __init__(self, message: str = "Already exists", status_code: int = 409) -> None:
        super().__init__(message, status_code)


class ValidationError(TypedDict):
    loc: tuple[int | str, ...]
    msg: LiteralString
    type: LiteralString
    input: Any


class PolarRequestValidationError(PolarError):
    def __init__(self, errors: list[ValidationError]) -> None:
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
