import argparse
import json
import pathlib
import sys

from joserfc.errors import JoseError
from joserfc.jwk import KeyParameters, KeySet, RSAKey


def generate_jwks(kid: str, size: int = 2048) -> str:
    options: KeyParameters = {"kid": kid, "use": "sig"}
    key = RSAKey.generate_key(size, options, private=True)
    return json.dumps(KeySet([key]).as_dict(private=True))


TIP_MESSAGE = (
    "If you're in local development, you can generate a JWKS file "
    "by running the following command:\n"
    "uv run task generate_dev_jwks"
)


def load_jwks(value: str) -> KeySet:
    """Read a key set from a path, or from the document itself."""
    raw = value.strip()
    # The setting may carry the JWKS document itself instead of a path, for
    # hosts where keys come from an environment variable (e.g. Vercel).
    if raw.startswith("{"):
        try:
            return KeySet.import_key_set(json.loads(raw))
        except (ValueError, KeyError, TypeError, JoseError) as e:
            raise ValueError(
                f"The provided JWKS value is not a valid JWKS document.\n{TIP_MESSAGE}"
            ) from e

    path = pathlib.Path(raw)
    if not path.exists() and not path.is_file():
        raise ValueError(
            f"The provided JWKS path {value} is not a valid file path "
            f"or does not exist.\n{TIP_MESSAGE}"
        )

    try:
        with open(path) as f:
            return KeySet.import_key_set(json.load(f))
    except (ValueError, KeyError, TypeError, JoseError) as e:
        raise ValueError(
            f"The provided JWKS file {value} is not a valid JWKS file.\n{TIP_MESSAGE}"
        ) from e


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
