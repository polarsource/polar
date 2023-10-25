import json
from typing import Any


# Homegrown and simple version of VCR
def read_cassette(filename: str) -> dict[str, Any]:
    filename = f"tests/fixtures/cassettes/{filename}"
    with open(filename) as fp:
        cassette: dict[str, Any] = json.loads(fp.read())
        return cassette
