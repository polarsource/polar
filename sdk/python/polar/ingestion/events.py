import typing

if typing.TYPE_CHECKING:
    from polar.v2026_04.inputs import (
        EventCreateCustomer as EventCreateCustomerv2026_04,
    )
    from polar.v2026_04.inputs import (
        EventCreateExternalCustomer as EventCreateExternalCustomerv2026_04,
    )
    from polar.v2026_10.inputs import (
        EventCreateCustomer as EventCreateCustomerv2026_10,
    )
    from polar.v2026_10.inputs import (
        EventCreateExternalCustomer as EventCreateExternalCustomerv2026_10,
    )
    from polar.v2027_01.inputs import (
        EventCreateCustomer as EventCreateCustomerv2027_01,
    )
    from polar.v2027_01.inputs import (
        EventCreateExternalCustomer as EventCreateExternalCustomerv2027_01,
    )

    EventInput: typing.TypeAlias = EventCreateCustomerv2026_04 | EventCreateExternalCustomerv2026_04 | EventCreateCustomerv2026_10 | EventCreateExternalCustomerv2026_10 | EventCreateCustomerv2027_01 | EventCreateExternalCustomerv2027_01
else:
    EventInput = object

__all__ = ["EventInput"]
