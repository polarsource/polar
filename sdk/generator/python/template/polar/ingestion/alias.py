import typing

if typing.TYPE_CHECKING:
{% for api in ir.versions %}
    from polar.{{ api | format_version }} import PolarAsync as PolarAsync{{ api | format_version }}
    from polar.{{ api | format_version }}.inputs import EventCreateCustomer as EventCreateCustomer{{ api | format_version }}, EventCreateExternalCustomer as EventCreateExternalCustomer{{ api | format_version }}
{% endfor %}

    PolarAsync: typing.TypeAlias = typing.Union[
        {% for api in ir.versions %}
        PolarAsync{{ api | format_version }},
        {% endfor %}
    ]

    EventInput: typing.TypeAlias = typing.Union[
        {% for api in ir.versions %}
        EventCreateCustomer{{ api | format_version }},
        EventCreateExternalCustomer{{ api | format_version }},
        {% endfor %}
    ]
else:
    PolarAsync = object
    EventInput = object

__all__ = ["PolarAsync", "EventInput"]
