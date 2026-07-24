from fastapi import FastAPI

from polar.events import EventTracker
from polar.events.polar import PolarDestination
from polar.events.posthog import PostHogDestination
from polar.v2026_04 import Polar

app = FastAPI()
polar = Polar(
    "polar_oat_bvoQigNbSZCF8stMPQSIFVAyg6NSUs9YKrQCQ3Mp03N", environment="sandbox"
)
tracker = EventTracker(
    destinations=[
        PolarDestination(polar),
        PostHogDestination("phc_sRFVcY9uyGnkVnoDwjXYfWQ2LGGBAZx5VL9KkcVxrn3J"),
    ]
)


@app.get("/track")
async def track_event():
    tracker.capture(
        {
            "name": "test_event",
            "account": "test_account",
            "actor": "test_actor",
            "attributes": {"key1": "value1", "key2": 42},
        }
    )
    tracker.flush()
    return {"message": "Event tracked successfully"}
