import argparse
import pathlib
import shutil
import sys

import openapi_pydantic as op

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
parser_generate.add_argument(
    "--language",
    type=str,
    choices=["python", "typescript"],
    default="python",
    help="Language to emit the SDK in (default: python).",
)
parser_generate.add_argument(
    "--clear",
    action="store_true",
    help="Clear the output directory before emitting the SDK (default: false).",
)

# Release subcommand
parser_release = subparsers.add_parser("release", help="Release a new SDK version")
parser_release.add_argument(
    "version", type=str, help="Version to release (e.g., 1.0.0-alpha.1)"
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

    language = args.language
    match language:
        case "python":
            emitter = PythonEmitter(ir)
        case "typescript":
            from typescript.emitter import TypeScriptEmitter

            emitter = TypeScriptEmitter(ir)
        case _:
            print(f"Error: Unsupported language {language}.", file=sys.stderr)
            sys.exit(1)

    emitter.emit(args.output)
    emitter.run_post_actions(args.output)

elif args.command == "release":
    release_sdk(
        version=args.version,
        skip_openapi=args.skip_openapi,
        skip_commit=args.skip_commit,
        dry_run=args.dry_run,
    )
