import argparse
import heapq
import json
from collections import defaultdict
from collections.abc import Mapping, Sequence
from pathlib import Path


def split_files(
    files: Sequence[Path], durations: Mapping[str, float], shards: int
) -> list[list[Path]]:
    file_durations: dict[str, float] = defaultdict(float)
    for node_id, duration in durations.items():
        file_durations[node_id.split("::", 1)[0]] += duration

    sizes = {file: file.stat().st_size for file in files}
    known_files = [file for file in files if file.as_posix() in file_durations]
    seconds_per_byte = (
        sum(file_durations[file.as_posix()] for file in known_files)
        / max(1, sum(sizes[file] for file in known_files))
        if known_files
        else 1.0
    )
    weights = {
        file: file_durations.get(file.as_posix(), sizes[file] * seconds_per_byte)
        for file in files
    }
    groups: list[list[Path]] = [[] for _ in range(shards)]
    heap = [(0.0, index) for index in range(shards)]
    for file in sorted(files, key=lambda file: (-weights[file], file.as_posix())):
        duration, index = heapq.heappop(heap)
        groups[index].append(file)
        heapq.heappush(heap, (duration + weights[file], index))
    return [sorted(group) for group in groups]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--shards", type=int, default=4)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--shard", type=int)
    selection.add_argument("--tinybird", action="store_true")
    parser.add_argument("--durations-path", type=Path, default=Path(".test_durations"))
    args = parser.parse_args()
    if args.shard is not None and not 1 <= args.shard <= args.shards:
        parser.error("--shard must be between 1 and --shards")

    files = sorted(
        file
        for file in Path("tests").rglob("*.py")
        if file.name.startswith("test_") or file.name.endswith("_test.py")
    )
    durations = (
        json.loads(args.durations_path.read_text())
        if args.durations_path.exists()
        else {}
    )
    selected = (
        [
            Path(file)
            for file in Path("tests/tinybird-files.txt").read_text().splitlines()
        ]
        if args.tinybird
        else split_files(files, durations, args.shards)[args.shard - 1]
    )
    if not selected:
        parser.error("shard contains no test files")
    if missing := set(selected) - set(files):
        parser.error(f"unknown test files: {sorted(missing)}")
    for file in selected:
        print(file.as_posix())


if __name__ == "__main__":
    main()
