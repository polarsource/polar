import dataclasses
import typing

Metadata: typing.TypeAlias = dict[str, str | float | bool]
Visibility: typing.TypeAlias = typing.Literal["public", "private"]


@dataclasses.dataclass(frozen=True, kw_only=True)
class Definition:
    """A meter, benefit, product or webhook declared as an attribute of a set.

    The attribute name becomes the external ID unless `external_id` says otherwise.
    """

    external_id: str | None = None
    metadata: Metadata | None = None
    deprecated: bool = False

    def __set_name__(self, owner: type, name: str) -> None:
        if self.external_id is None:
            object.__setattr__(self, "external_id", name)

    @property
    def id(self) -> str:
        if self.external_id is None:
            raise ValueError(
                f"{type(self).__name__} {self.describe()} is not declared in a set, "
                "so it has no external ID. Assign it as a class attribute, or pass external_id."
            )
        return self.external_id

    def describe(self) -> str:
        return f"with external ID {self.external_id!r}"


@dataclasses.dataclass(frozen=True, kw_only=True)
class VisibleDefinition(Definition):
    visibility: Visibility = "public"


D = typing.TypeVar("D", bound=Definition)


class DefinitionSet(typing.Generic[D]):
    """A class whose public attributes are definitions of one kind.

    Subclass it (`class Meters(MeterSet): ...`) and assign definitions. Anything else
    in the class body is rejected when the class is created.
    """

    item: typing.ClassVar[type[Definition]] = Definition
    _definitions: typing.ClassVar[dict[str, Definition]] = {}

    def __init_subclass__(cls) -> None:
        super().__init_subclass__()
        definitions: dict[str, Definition] = {}
        for name, value in vars(cls).items():
            if name.startswith("_") or isinstance(
                value, type | classmethod | staticmethod | property
            ):
                continue
            if not isinstance(value, cls.item):
                raise TypeError(
                    f"{cls.__name__}.{name} must be a {cls.item.__name__}, "
                    f"got {type(value).__name__}."
                )
            definitions[name] = value
        cls._definitions = definitions

    @classmethod
    def definitions(cls) -> list[D]:
        return typing.cast(list[D], list(cls._definitions.values()))


def definition_fields(definition: Definition) -> dict[str, typing.Any]:
    fields: dict[str, typing.Any] = {}
    if definition.metadata is not None:
        fields["metadata"] = dict(definition.metadata)
    if isinstance(definition, VisibleDefinition) and definition.visibility == "private":
        fields["visibility"] = "private"
    if definition.deprecated:
        fields["deprecated"] = True
    return fields
