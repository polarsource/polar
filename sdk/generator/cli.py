import argparse
import pathlib
import shutil
import sys

import openapi_pydantic as op

from generator.docs_openapi import DOCS_OPENAPI_PATH, generate_docs_openapi
from generator.emitter import Prerelease
from generator.ir import generate_ir
from generator.release import release_sdk
from python.emitter import PythonEmitter

parser = argparse.ArgumentParser(description="SDK Generator")
subparsers = parser.add_subparsers(dest="command")

# Generate subcommand
parser_generate = subparsers.add_parser(
    "generate", help="Generate SDK from OpenAPI spec"
)
parser_generate.add_argument("spec_path", type=str, help="Path to OpenAPI spec file.")
parser_generate.add_argument(
    "output", type=str, help="Directory to output the generated SDK"
)

parser_docs_openapi = subparsers.add_parser(
    "docs-openapi", help="Generate the public OpenAPI spec for the documentation"
)
parser_docs_openapi.add_argument(
    "--output",
    type=pathlib.Path,
    default=DOCS_OPENAPI_PATH,
    help=f"Output path (default: {DOCS_OPENAPI_PATH}).",
)
parser_docs_openapi.add_argument(
    "--version",
    type=str,
    default="0.0.0",
    help="SDK version represented by the code samples (default: 0.0.0).",
)
parser_generate.add_argument(
    "--language",
    type=str,
    choices=["python", "typescript"],
    default="python",
    help="Language to emit the SDK in (default: python).",
)
parser_generate.add_argument(
    "--version",
    type=str,
    default="0.0.0",
    help="Version of the SDK to emit (default: 0.0.0).",
)
parser_generate.add_argument(
    "--prerelease",
    type=str,
    default=None,
    help="Prerelease identifier in the form <label>.<number>, e.g. alpha.1, beta.2, rc.1.",
)
parser_generate.add_argument(
    "--clear",
    action="store_true",
    help="Clear the output directory before emitting the SDK (default: false).",
)

# Release subcommand
parser_release = subparsers.add_parser("release", help="Release a new SDK version")
parser_release.add_argument(
    "version", type=str, help="Base version to release (e.g., 1.0.0)"
)
parser_release.add_argument(
    "--prerelease",
    type=str,
    default=None,
    help="Prerelease identifier in the form <label>.<number>, e.g. alpha.1, beta.2, rc.1.",
)
parser_release.add_argument(
    "--skip-openapi", action="store_true", help="Skip OpenAPI regeneration"
)
parser_release.add_argument(
    "--skip-commit", action="store_true", help="Skip git commit"
)
parser_release.add_argument(
    "--dry-run", action="store_true", help="Dry run without making changes"
)

args = parser.parse_args()

if args.command is None:
    parser.print_help()
    sys.exit(1)

if args.command == "generate":
    spec_path = pathlib.Path(args.spec_path)
    if not spec_path.exists():
        print(f"Error: Spec file {spec_path} does not exist.", file=sys.stderr)
        sys.exit(1)
    if not spec_path.is_file():
        print(f"Error: Spec path {spec_path} is not a file.", file=sys.stderr)
        sys.exit(1)

    with open(spec_path) as f:
        raw_spec = f.read()

    spec = op.OpenAPI.model_validate_json(raw_spec)
    ir = generate_ir(spec)

    output_path = pathlib.Path(args.output)
    if output_path.exists() and not output_path.is_dir():
        print(f"Error: Output path {output_path} is not a directory.", file=sys.stderr)
        sys.exit(1)
    if args.clear:
        if output_path.exists():
            shutil.rmtree(output_path)

    prerelease: Prerelease | None = None
    if args.prerelease is not None:
        try:
            prerelease = Prerelease.parse(args.prerelease)
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

    language = args.language
    match language:
        case "python":
            emitter = PythonEmitter(ir, args.version, prerelease=prerelease)
        case "typescript":
            from typescript.emitter import TypeScriptEmitter

            emitter = TypeScriptEmitter(ir, args.version, prerelease=prerelease)
        case _:
            print(f"Error: Unsupported language {language}.", file=sys.stderr)
            sys.exit(1)

    emitter.emit(args.output)
    emitter.run_post_actions(args.output)

elif args.command == "docs-openapi":
    generate_docs_openapi(args.output, args.version)

elif args.command == "release":
    prerelease = None
    if args.prerelease is not None:
        try:
            prerelease = Prerelease.parse(args.prerelease)
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

    release_sdk(
        version=args.version,
        prerelease=prerelease,
        skip_openapi=args.skip_openapi,
        skip_commit=args.skip_commit,
        dry_run=args.dry_run,
    )
