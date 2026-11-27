import argparse
import json
from collections.abc import Sequence
from pathlib import Path


def merge_durations(paths: Sequence[Path]) -> dict[str, float]:
    merged: dict[str, float] = {}
    for path in paths:
        durations = json.loads(path.read_text())
        if duplicates := merged.keys() & durations.keys():
            raise ValueError(
                f"Test duration appears in multiple shards: {min(duplicates)}"
            )
        merged.update(durations)
    return merged


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", type=Path)
    parser.add_argument("--expected-shards", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if len(args.paths) != args.expected_shards:
        parser.error(f"Expected {args.expected_shards} shard duration files")
    durations = merge_durations(args.paths)
    args.output.write_text(json.dumps(durations, sort_keys=True, indent=2))


if __name__ == "__main__":
    main()
