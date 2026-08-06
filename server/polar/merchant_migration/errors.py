from polar.exceptions import PolarError


class MerchantMigrationError(PolarError):
    """Base for everything this module raises, so a caller can catch the whole
    feature in one clause."""
