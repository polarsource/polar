import argparse
import pathlib
import sys
from typing import Annotated, Any

from authlib.jose import JsonWebKey, KeySet
from pydantic import PlainValidator


def generate_jwks(kid: str, size: int = 2048) -> str:
    options = {"kid": kid, "use": "sig"}
    key = JsonWebKey.generate_key("RSA", size, options, is_private=True)
    keyset = KeySet(keys=[key])
    return keyset.as_json(is_private=True)


TIP_MESSAGE = (
    "If you're in local development, you can generate a JWKS file "
    "by running the following command:\n"
    "uv run task generate_dev_jwks"
)


def _validate_jwks(value: Any) -> KeySet:
    path = pathlib.Path(str(value))
    if not path.exists() and not path.is_file():
        raise ValueError(
            f"The provided JWKS path {value} is not a valid file path "
            f"or does not exist.\n{TIP_MESSAGE}"
        )

    try:
        with open(value) as f:
            content = f.read().strip()
            return JsonWebKey.import_key_set(content)
    except ValueError as e:
        raise ValueError(
            f"The provided JWKS file {value} is not a valid JWKS file.\n{TIP_MESSAGE}"
        ) from e


JWKSFile = Annotated[KeySet, PlainValidator(_validate_jwks)]

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate JWKS")
    parser.add_argument("kid", type=str, help="Key ID")
    parser.add_argument(
        "--size", type=int, default=2048, help="Key size (default: 2048)"
    )
    args = parser.parse_args()

    jwks = generate_jwks(args.kid, args.size)
    sys.stdout.write(jwks)
    sys.stdout.write("\n")
