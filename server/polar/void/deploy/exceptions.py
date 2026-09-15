from polar.exceptions import PolarError


class DeploymentConflict(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 409)


class InvalidDeployment(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 400)
