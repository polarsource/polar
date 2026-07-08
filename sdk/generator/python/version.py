import argparse
import pathlib

TEMPLATE_PATH = pathlib.Path(__file__).parent / "template/polar/__init__.py"


def update_version(version: str) -> None:
    content = TEMPLATE_PATH.read_text()
    content = content.replace('__version__ = "0.0.0"', f'__version__ = "{version}"')
    TEMPLATE_PATH.write_text(content)


def main() -> None:
    parser = argparse.ArgumentParser(description="Update Python SDK template version")
    parser.add_argument("version", type=str, help="Version to set")
    args = parser.parse_args()
    update_version(args.version)
    print(f"Updated Python template version to {args.version}")


if __name__ == "__main__":
    main()
