import argparse
import os
import signal
import subprocess
import sys
import time
from types import FrameType


def interrupted(signum: int, frame: FrameType | None) -> None:
    raise KeyboardInterrupt


def main() -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--timeout", type=int, default=900)
    options, _ = parser.parse_known_args()
    if not 1 <= options.timeout <= 900:
        parser.error("--timeout must be between 1 and 900 seconds")
    signal.signal(signal.SIGTERM, interrupted)
    process = subprocess.Popen(
        [sys.executable, "-m", "scripts.pytest_pool.pool", *sys.argv[1:]],
        start_new_session=True,
    )
    try:
        status = process.wait(timeout=options.timeout)
        return status if status >= 0 else 128 - status
    except subprocess.TimeoutExpired:
        print(f"CI pool exceeded {options.timeout}s", file=sys.stderr)
        return 124
    except KeyboardInterrupt:
        return 130
    finally:
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        else:
            time.sleep(0.2)
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
