import argparse

import uvicorn

from outpost.env import get_environment


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Polar Outpost")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9000)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    if args.workers < 1:
        parser.error("--workers must be greater than zero")
    env = get_environment()
    if env.redis_url is None and args.workers != 1:
        parser.error("Memory storage requires exactly one worker")
    uvicorn.run(
        "outpost:app",
        host=args.host,
        port=args.port,
        workers=args.workers,
        reload=args.reload,
        lifespan="on",
    )


if __name__ == "__main__":
    main()
