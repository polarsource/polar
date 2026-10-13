from polar.exceptions import PolarError


class ConfigAsCodeNotEnabled(PolarError):
    def __init__(self) -> None:
        super().__init__("Config as code is not enabled for this organization.", 403)
