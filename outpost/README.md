# Outpost

Logging is configured at application startup and writes to stderr at `INFO` level,
with timestamps, levels, and logger names. Existing root logging handlers are
preserved.

Use a module-level logger and lazy message formatting:

```python
import logging

logger = logging.getLogger(__name__)
logger.info("Processed %s events", count)
```

To choose another level, call `configure_logging("DEBUG")` from `outpost.logging`
before application startup.
