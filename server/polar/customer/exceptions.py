from polar.exceptions import PolarError


class AmbiguousExternalCustomerID(PolarError):
    def __init__(self, external_customer_id: str) -> None:
        self.external_customer_id = external_customer_id
        super().__init__(
            "Several customers across your organizations share this external "
            "customer ID. Use an organization-scoped token, the Polar customer "
            "ID, or a unique external ID to disambiguate.",
            409,
        )
