import argparse
import os
import signal
import subprocess
import sys
import time


def main() -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--timeout", type=int, default=900)
    options, _ = parser.parse_known_args()
    if not 1 <= options.timeout <= 900:
        raise SystemExit("--timeout must be between1 and900 seconds")
    def interrupted(signum, frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, interrupted)
    process = subprocess.Popen([sys.executable, "-m", "ci_pool.pool", *sys.argv[1:]], start_new_session=True)
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
        # The dedicated session contains only this proof's supervisor, forkserver,
        # resource tracker and workers; the caller's process group is never killed.
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
