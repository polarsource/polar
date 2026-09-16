from polar.exceptions import PolarError


class InvalidBranch(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 400)


class BranchBaseUnavailable(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "This version was deployed before configurations were stored and "
            "cannot be branched; push it again to store its configuration.",
            400,
        )
