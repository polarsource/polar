from polar.exceptions import PolarError


class DeploymentConflict(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 409)


class InvalidDeployment(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 400)


class DeploymentNotActivatable(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "The organization must pass review before a deployment can be activated.",
            403,
        )
