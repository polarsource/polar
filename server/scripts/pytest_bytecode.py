import argparse
import hashlib
import importlib.util
import struct
from pathlib import Path

from _pytest.assertion.rewrite import PYC_TAIL, get_cache_dir


def synchronize_cache(test_root: Path, cache_root: Path, *, restore: bool) -> int:
    count = 0
    current_keys: set[Path] = set()
    for source in sorted(test_root.resolve().rglob("*.py")):
        digest = hashlib.sha256(
            str(source).encode() + b"\0" + source.read_bytes()
        ).hexdigest()
        cached = cache_root / (digest + PYC_TAIL)
        current_keys.add(cached)
        rewritten = get_cache_dir(source) / (source.stem + PYC_TAIL)
        stat = source.stat()
        header = (
            importlib.util.MAGIC_NUMBER
            + b"\0" * 4
            + struct.pack(
                "<LL", int(stat.st_mtime) & 0xFFFFFFFF, stat.st_size & 0xFFFFFFFF
            )
        )
        if restore:
            if cached.exists():
                data = cached.read_bytes()
                if len(data) > 16 and data[:8] == header[:8]:
                    rewritten.parent.mkdir(parents=True, exist_ok=True)
                    rewritten.write_bytes(header + data[16:])
                    count += 1
                    continue
            rewritten.unlink(missing_ok=True)
        elif rewritten.exists():
            data = rewritten.read_bytes()
            if data[:16] == header:
                cache_root.mkdir(parents=True, exist_ok=True)
                cached.write_bytes(data)
                count += 1
    if not restore:
        for cached in cache_root.glob("*.pyc"):
            if cached not in current_keys:
                cached.unlink()
    return count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("restore", "store"))
    parser.add_argument("--tests", type=Path, default=Path("tests"))
    parser.add_argument("--cache", type=Path, required=True)
    args = parser.parse_args()
    count = synchronize_cache(args.tests, args.cache, restore=args.mode == "restore")
    print(f"{args.mode}: {count} pytest bytecode files")


if __name__ == "__main__":
    main()
