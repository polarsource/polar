import typing


class Entry:
    """Something declared as an attribute of a set, like a meter.

    The attribute name is its external ID, unless `external_id` is set.
    """

    external_id: str | None


AnyEntry = typing.TypeVar("AnyEntry", bound=Entry)


def declared(owner: type, kind: type[AnyEntry]) -> list[tuple[str, AnyEntry]]:
    """The entries of `kind` on a set and the sets it inherits, by external ID."""
    by_attribute: dict[str, AnyEntry] = {}
    for base in reversed(owner.__mro__):
        renamed = f"_{base.__name__.lstrip('_')}__"
        for attribute, value in vars(base).items():
            if not isinstance(value, kind):
                continue
            if attribute.startswith(renamed):
                raise ValueError(
                    f"{base.__name__}.__{attribute.removeprefix(renamed)}: Python "
                    'renames attributes that start with "__". Use another name.'
                )
            by_attribute[attribute] = value
    return [
        (entry.external_id or attribute, entry)
        for attribute, entry in by_attribute.items()
    ]
