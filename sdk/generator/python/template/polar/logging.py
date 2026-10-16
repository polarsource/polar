import logging


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def configure_logger(
    *,
    level: int = logging.WARNING,
    handler: logging.Handler | None = None,
) -> logging.Logger:
    logger = logging.getLogger("polar")
    logger.setLevel(level)

    if handler is None:
        handler = next(
            (handler for handler in logger.handlers if handler.name == "polar.default"),
            None,
        )
        if handler is None:
            handler = logging.StreamHandler()
            handler.set_name("polar.default")
            handler.setFormatter(
                logging.Formatter(
                    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
                )
            )
        handler.setLevel(level)

    logger.addHandler(handler)
    return logger


def _ensure_null_handler() -> None:
    logger = logging.getLogger("polar")
    if not logger.handlers:
        logger.addHandler(logging.NullHandler())


# Ensure null handler is added when this module is imported
_ensure_null_handler()
