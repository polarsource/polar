import argparse
import pathlib

TEMPLATE_PATH = pathlib.Path(__file__).parent / "template/package.json"


def update_version(version: str) -> None:
    content = TEMPLATE_PATH.read_text()
    new_content = content.replace('"version": "0.0.0"', f'"version": "{version}"')
    if new_content == content:
        raise ValueError(f"Version placeholder '0.0.0' not found in {TEMPLATE_PATH}")
    TEMPLATE_PATH.write_text(new_content)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Update TypeScript SDK template version"
    )
    parser.add_argument("version", type=str, help="Version to set")
    args = parser.parse_args()
    update_version(args.version)
    print(f"Updated TypeScript template version to {args.version}")


if __name__ == "__main__":
    main()
