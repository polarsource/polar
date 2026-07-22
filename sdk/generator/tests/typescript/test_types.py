from generator.ir import PrimitiveType, UnionType
from typescript.types import convert_type_to_typescript


def test_convert_type_to_typescript_deduplicates_union_members() -> None:
    type_ref = UnionType(
        kind="union",
        variants=[
            PrimitiveType(kind="primitive", type="integer"),
            PrimitiveType(kind="primitive", type="number"),
        ],
    )

    assert convert_type_to_typescript(type_ref) == "number"
