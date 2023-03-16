from sqlalchemy import exc as sqlalchemy

IntegrityError = sqlalchemy.IntegrityError


class AuthenticationRequired(Exception):
    """Attempted action requires authentication."""


class NotPermitted(Exception):
    ...


class InvalidPlatform(Exception):
    ...


class InvalidRequest(Exception):
    ...


class StripeError(Exception):
    ...


class DatabaseRecordExists(Exception):
    ...


class ResourceNotFound(Exception):
    ...
