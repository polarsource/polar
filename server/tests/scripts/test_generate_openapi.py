from polar.version import VERSIONS
from scripts.generate_openapi import generate_schemas


def test_generate_schemas_does_not_depend_on_version_order() -> None:
    forward = generate_schemas(sorted(VERSIONS))
    backward = generate_schemas(sorted(VERSIONS, reverse=True))

    assert forward == backward
