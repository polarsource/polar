from polar.exceptions import PolarError


class InvalidReducer(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 400)
