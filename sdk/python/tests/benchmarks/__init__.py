import json
import pathlib

# The same data as the TypeScript benchmarks: sdk/generator/benchmarks/outpost.json.
DATA = json.loads(pathlib.Path(__file__).with_name("benchmark.json").read_text())
