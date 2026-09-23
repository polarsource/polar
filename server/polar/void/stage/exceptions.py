from polar.exceptions import PolarError


class StageConflict(PolarError):
    def __init__(self) -> None:
        super().__init__("The stage changed. Reload it before trying again.", 409)
