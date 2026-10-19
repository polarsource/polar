import json
import pathlib

# Shared benchmark data, copied from sdk/generator/benchmarks/outpost.json.
DATA = json.loads(pathlib.Path(__file__).with_name("benchmark.json").read_text())
