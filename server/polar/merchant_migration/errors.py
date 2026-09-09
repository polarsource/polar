from polar.exceptions import PolarError


class MerchantMigrationError(PolarError):
    """Base for everything this module raises, so a caller can catch the whole
    feature in one clause."""


class ProductMappingInvalid(MerchantMigrationError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 400)


class ProductMappingLocked(MerchantMigrationError):
    def __init__(self) -> None:
        super().__init__(
            "This product has already been imported, so its mapping can't change.",
            409,
        )
