use axum::{
    Router,
    body::{Body, to_bytes},
    http::{
        Request, StatusCode,
        header::{AUTHORIZATION, CONTENT_LENGTH, CONTENT_TYPE},
    },
};
use chrono::{TimeDelta, Utc};
use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use events::{
    app::{self, AppState},
    config::Config,
};
use serde_json::{Value, json};
use tokio::runtime::Runtime;
use tower::ServiceExt;
use uuid::Uuid;

const TOKEN: &str = "polar_oat_benchmark";
const EVENT_NAMES: [&str; 4] = ["TEST_EVENT", "benchmark.b", "benchmark.c", "benchmark.d"];
const BATCH_SIZES: [usize; 2] = [9, 26];
const DATABASE_SUFFIX: &str = "_benchmarks_events";
const REDIS_DATABASE_SUFFIX: &str = "/14";
const MAX_RESPONSE_SIZE: usize = 1024;

fn staged_events(size: usize, batch: &str, late: bool) -> Value {
    let timestamp = late.then(|| (Utc::now() - TimeDelta::minutes(10)).to_rfc3339());
    let events = Vec::from_iter((0..size).map(|index| {
        let mut event = json!({
            "name": EVENT_NAMES[index % EVENT_NAMES.len()],
            "external_customer_id": format!("customer-{}", index % 3),
            "external_id": format!("{batch}-{index}"),
        });
        if let Some(timestamp) = &timestamp {
            event["timestamp"] = json!(timestamp);
        }
        event
    }));
    json!({ "events": events })
}

async fn ingest(router: Router, size: usize, late: bool) -> u64 {
    let body = serde_json::to_vec(&staged_events(size, &Uuid::new_v4().to_string(), late))
        .expect("events serialize to JSON");
    let request = Request::post("/v1/events/ingest")
        .header(AUTHORIZATION, format!("Bearer {TOKEN}"))
        .header(CONTENT_TYPE, "application/json")
        .header(CONTENT_LENGTH, body.len())
        .body(Body::from(body))
        .expect("the request is valid");
    let response = router
        .oneshot(request)
        .await
        .expect("the router is infallible");
    let status = response.status();
    let body = to_bytes(response.into_body(), MAX_RESPONSE_SIZE)
        .await
        .expect("the response is small");
    assert_eq!(status, StatusCode::OK, "{}", String::from_utf8_lossy(&body));
    serde_json::from_slice::<Value>(&body).expect("the response is JSON")["inserted"]
        .as_u64()
        .expect("the response counts inserted events")
}

fn benchmarks(criterion: &mut Criterion) {
    let runtime = Runtime::new().expect("a Tokio runtime starts");
    let config = Config::from_env().expect("the configuration is valid");
    assert!(
        config
            .postgres
            .get_database()
            .is_some_and(|database| database.ends_with(DATABASE_SUFFIX)),
        "run `just bench`, which targets the benchmark database"
    );
    assert!(
        config.redis_url.ends_with(REDIS_DATABASE_SUFFIX),
        "run `just bench`, which targets the benchmark Redis database"
    );
    let state = runtime
        .block_on(AppState::connect(config))
        .expect("run `just bench-seed` first");
    runtime.block_on(async {
        sqlx::query("TRUNCATE staged_events, reducer_buckets")
            .execute(&state.db)
            .await
            .expect("the benchmark tables can be emptied");
        redis::cmd("FLUSHDB")
            .query_async::<()>(&mut state.redis.clone())
            .await
            .expect("the benchmark Redis database can be emptied");
    });
    let router = app::router(state.clone());

    for (name, late) in [
        ("ingest_staged_events_http", false),
        ("ingest_late_staged_events_http", true),
    ] {
        let mut group = criterion.benchmark_group(name);
        for size in BATCH_SIZES {
            assert_eq!(
                runtime.block_on(ingest(router.clone(), size, late)),
                size as u64
            );
            runtime.block_on(async {
                sqlx::query("ANALYZE")
                    .execute(&state.db)
                    .await
                    .expect("the benchmark database can be analyzed");
            });
            group.bench_with_input(
                BenchmarkId::from_parameter(size),
                &size,
                |bencher, &size| {
                    bencher.iter(|| runtime.block_on(ingest(router.clone(), size, late)));
                },
            );
        }
        group.finish();
    }
}

criterion_group!(benches, benchmarks);
criterion_main!(benches);
