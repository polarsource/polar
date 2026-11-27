from generator.ir import ModelRef, UnionDiscriminator, UnionType
from python.types import convert_type_to_annotation


def test_discriminator_implicit_mapping_preserves_explicit_tags() -> None:
    union = UnionType(
        kind="union",
        variants=[ModelRef(kind="model", name=name) for name in ("A", "B", "C")],
        discriminator=UnionDiscriminator(property_name="type", mapping={"B": "A"}),
    )

    assert convert_type_to_annotation(union) == (
        "typing.Annotated[A | B | C, _Discriminator('type', (('B', A),('C', C),))]"
    )
