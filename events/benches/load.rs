use std::{
    fmt::Write,
    process::Command,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};

use axum::{
    Router,
    body::{Body, to_bytes},
    http::{
        Request, StatusCode,
        header::{AUTHORIZATION, CONTENT_LENGTH, CONTENT_TYPE},
    },
};
use events::{
    app::{self, AppState},
    config::Config,
};
use tower::ServiceExt;
use uuid::Uuid;

const TOKEN: &str = "polar_oat_benchmark";
const EVENT_NAMES: [&str; 4] = ["TEST_EVENT", "benchmark.b", "benchmark.c", "benchmark.d"];
const BATCH_SIZE: usize = 100;
const CONCURRENCIES: [usize; 5] = [1, 4, 16, 64, 256];
const WARM_UP: Duration = Duration::from_secs(2);
const MEASURED: Duration = Duration::from_secs(8);
const DATABASE_SUFFIX: &str = "_benchmarks_events";
const REDIS_DATABASE_SUFFIX: &str = "/14";
const MAX_RESPONSE_SIZE: usize = 1024;

fn batch() -> Vec<u8> {
    let batch = Uuid::new_v4();
    let mut body = String::from(r#"{"events":["#);
    for index in 0..BATCH_SIZE {
        let separator = if index == 0 { "" } else { "," };
        let name = EVENT_NAMES[index % EVENT_NAMES.len()];
        write!(
            body,
            r#"{separator}{{"name":"{name}","external_customer_id":"customer-{}","external_id":"{batch}-{index}","metadata":{{"tokens":{index},"model":"benchmark"}}}}"#,
            index % 3
        )
        .expect("writing to a String cannot fail");
    }
    body.push_str("]}");
    body.into_bytes()
}

async fn ingest(router: Router) -> Duration {
    let body = batch();
    let request = Request::post("/v1/events/ingest")
        .header(AUTHORIZATION, format!("Bearer {TOKEN}"))
        .header(CONTENT_TYPE, "application/json")
        .header(CONTENT_LENGTH, body.len())
        .body(Body::from(body))
        .expect("the request is valid");
    let started = Instant::now();
    let response = router
        .oneshot(request)
        .await
        .expect("the router is infallible");
    let status = response.status();
    let body = to_bytes(response.into_body(), MAX_RESPONSE_SIZE)
        .await
        .expect("the response is small");
    assert_eq!(status, StatusCode::OK, "{}", String::from_utf8_lossy(&body));
    started.elapsed()
}

fn cpu_time() -> Duration {
    let output = Command::new("ps")
        .args(["-o", "time=", "-p", &std::process::id().to_string()])
        .output()
        .expect("ps runs");
    let text = String::from_utf8_lossy(&output.stdout);
    let seconds = text.trim().split(':').fold(0.0, |total, part| {
        total * 60.0 + part.parse::<f64>().expect("ps prints [[hh:]mm:]ss.ss")
    });
    Duration::from_secs_f64(seconds)
}

async fn run(router: &Router, concurrency: usize, duration: Duration) -> Vec<Duration> {
    let stop = Arc::new(AtomicBool::new(false));
    let workers = Vec::from_iter((0..concurrency).map(|_| {
        let (router, stop) = (router.clone(), stop.clone());
        tokio::spawn(async move {
            let mut latencies = Vec::new();
            while !stop.load(Ordering::Relaxed) {
                latencies.push(ingest(router.clone()).await);
            }
            latencies
        })
    }));
    tokio::time::sleep(duration).await;
    stop.store(true, Ordering::Relaxed);
    let mut latencies = Vec::new();
    for worker in workers {
        latencies.extend(worker.await.expect("a worker finishes"));
    }
    latencies
}

#[tokio::main]
async fn main() {
    let config = Config::from_env().expect("the configuration is valid");
    assert!(
        config
            .postgres
            .get_database()
            .is_some_and(|database| database.ends_with(DATABASE_SUFFIX)),
        "run `just load`, which targets the benchmark database"
    );
    assert!(
        config.redis_url.ends_with(REDIS_DATABASE_SUFFIX),
        "run `just load`, which targets the benchmark Redis database"
    );
    let pool_size = config.postgres_pool_size;
    let state = AppState::connect(config)
        .await
        .expect("run `just bench-seed` first");
    let router = app::router(state.clone());

    println!("{BATCH_SIZE} events per request, {pool_size} database connections");
    println!(
        "{:>11} {:>10} {:>11} {:>9} {:>9} {:>14}",
        "concurrency", "requests/s", "events/s", "p50 ms", "p99 ms", "CPU µs/event"
    );
    for concurrency in CONCURRENCIES {
        sqlx::query("TRUNCATE staged_events, reducer_buckets")
            .execute(&state.db)
            .await
            .expect("the benchmark tables can be emptied");
        redis::cmd("FLUSHDB")
            .query_async::<()>(&mut state.redis.clone())
            .await
            .expect("the benchmark Redis database can be emptied");
        run(&router, concurrency, WARM_UP).await;

        let cpu_before = cpu_time();
        let started = Instant::now();
        let mut latencies = run(&router, concurrency, MEASURED).await;
        let elapsed = started.elapsed().as_secs_f64();
        let cpu = cpu_time().saturating_sub(cpu_before);

        latencies.sort();
        let events = (latencies.len() * BATCH_SIZE) as f64;
        let percentile = |fraction: f64| {
            latencies[((latencies.len() - 1) as f64 * fraction) as usize].as_secs_f64() * 1e3
        };
        println!(
            "{concurrency:>11} {:>10.0} {:>11.0} {:>9.2} {:>9.2} {:>14.2}",
            latencies.len() as f64 / elapsed,
            events / elapsed,
            percentile(0.5),
            percentile(0.99),
            cpu.as_secs_f64() * 1e6 / events,
        );
    }
    state.tasks.close();
    state.tasks.wait().await;
}
