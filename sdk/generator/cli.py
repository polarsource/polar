import argparse
import pathlib
import shutil
import sys

import openapi_pydantic as op

from generator.ir import generate_ir
from python.emitter import PythonEmitter

parser = argparse.ArgumentParser(description="Generate SDK from OpenAPI spec.")
parser.add_argument("spec_path", type=str, help="Path to OpenAPI spec file.")
parser.add_argument("output", type=str, help="Directory to output the generated SDK")
parser.add_argument(
    "--language",
    type=str,
    choices=["python"],
    default="python",
    help="Language to emit the SDK in (default: python).",
)
parser.add_argument(
    "--clear",
    action="store_true",
    help="Clear the output directory before emitting the SDK (default: false).",
)
args = parser.parse_args()

spec_path = pathlib.Path(args.spec_path)
if not spec_path.exists():
    print(f"Error: Spec file {spec_path} does not exist.", file=sys.stderr)
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
    case _:
        print(f"Error: Unsupported language {language}.", file=sys.stderr)
        sys.exit(1)

emitter.emit(args.output)
emitter.run_post_actions(args.output)
