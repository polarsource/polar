import abc
import typing

from polar.postgres import AsyncReadSession


class InvariantError(Exception):
    """Exception raised when an invariant check fails."""

    def __init__(
        self,
        invariant: type["Invariant"],
        message: str,
        context: dict[str, typing.Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.invariant = invariant
        self.message = message
        self.context = context or {}


class Invariant(abc.ABC):
    """
    Base class for invariants that can be checked against a given state.

    Invariants are conditions that must always hold true for the system to be considered in a valid state.
    """

    def __init__(self, session: AsyncReadSession) -> None:
        self.session = session

    @abc.abstractmethod
    async def check(self) -> None:
        """
        Check the invariant against the current state.

        Raises:
            InvariantError: If the invariant is violated.
        """
        pass
