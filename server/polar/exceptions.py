from sqlalchemy import exc as sqlalchemy

IntegrityError = sqlalchemy.IntegrityError


class AuthorizationRequired(Exception):
    """Attempted action is privileged and requires authorization"""


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


class ExpectedIssueGotPullRequest(Exception):
    ...
