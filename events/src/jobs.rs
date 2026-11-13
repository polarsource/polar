use std::time::{Duration, SystemTime, UNIX_EPOCH};

use redis::{RedisResult, aio::ConnectionManager};
use serde::Serialize;
use serde_json::{Map, Value, json};
use uuid::Uuid;

const QUEUE: &str = "low_priority";
const DEBOUNCE_KEY_PREFIX: &str = "debounce:";
const DEBOUNCE_KEY_TTL_SECONDS: i64 = 60 * 60;
const DEFAULT_DEBOUNCE_MIN_THRESHOLD: Duration = Duration::from_secs(15);
const REDUCER_BUCKET_SYNC_DEBOUNCE_MIN_THRESHOLD: Duration = Duration::from_secs(10);

pub struct Job {
    actor: &'static str,
    args: Vec<Value>,
    kwargs: Map<String, Value>,
    delay: Option<Duration>,
    debounce: Option<Debounce>,
}

struct Debounce {
    key: String,
    min_threshold: Duration,
}

impl Job {
    pub fn record_organization_access_token_usage(
        token_id: Uuid,
        last_used_at: SystemTime,
    ) -> Self {
        let last_used_at = last_used_at
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs_f64();
        let mut kwargs = Map::new();
        kwargs.insert("organization_access_token_id".to_owned(), json!(token_id));
        kwargs.insert("last_used_at".to_owned(), json!(last_used_at));
        Self {
            actor: "organization_access_token.record_usage",
            args: Vec::new(),
            kwargs,
            delay: None,
            debounce: Some(Debounce {
                key: format!("organization_access_token.record_usage:{token_id}"),
                min_threshold: DEFAULT_DEBOUNCE_MIN_THRESHOLD,
            }),
        }
    }

    pub fn sync_reducer_bucket(
        reducer_id: Uuid,
        bucket_start: &str,
        bucket_key: &str,
        customer_id: Option<Uuid>,
        external_customer_id: Option<&str>,
        delay: Duration,
    ) -> Self {
        Self {
            actor: "reducer_bucket.sync",
            args: vec![
                json!(reducer_id),
                json!(bucket_start),
                json!(customer_id),
                json!(external_customer_id),
            ],
            kwargs: Map::new(),
            delay: Some(delay),
            debounce: Some(Debounce {
                key: format!("reducer_bucket.sync:{bucket_key}"),
                min_threshold: REDUCER_BUCKET_SYNC_DEBOUNCE_MIN_THRESHOLD,
            }),
        }
    }
}

#[derive(Serialize)]
struct Message {
    queue_name: String,
    actor_name: &'static str,
    args: Vec<Value>,
    kwargs: Map<String, Value>,
    options: MessageOptions,
    message_id: Uuid,
    message_timestamp: u64,
}

#[derive(Serialize)]
struct MessageOptions {
    redis_message_id: Uuid,
    source_correlation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    debounce_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    eta: Option<u64>,
}

impl Message {
    fn new(job: Job, now: Duration, message_id: Uuid, redis_message_id: Uuid) -> Self {
        let now_millis = now.as_millis() as u64;
        let delay = match &job.debounce {
            Some(debounce) => Some(job.delay.unwrap_or_default().max(debounce.min_threshold)),
            None => job.delay,
        }
        .filter(|delay| !delay.is_zero());

        Self {
            queue_name: match delay {
                Some(_) => format!("{QUEUE}.DQ"),
                None => QUEUE.to_owned(),
            },
            actor_name: job.actor,
            args: job.args,
            kwargs: job.kwargs,
            options: MessageOptions {
                redis_message_id,
                source_correlation_id: None,
                debounce_key: job
                    .debounce
                    .map(|debounce| format!("{DEBOUNCE_KEY_PREFIX}{}", debounce.key)),
                eta: delay.map(|delay| now_millis + delay.as_millis() as u64),
            },
            message_id,
            message_timestamp: now_millis,
        }
    }
}

pub async fn enqueue(redis: &mut ConnectionManager, jobs: Vec<Job>) -> RedisResult<()> {
    if jobs.is_empty() {
        return Ok(());
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let mut pipeline = redis::pipe();
    pipeline.atomic();
    for job in jobs {
        let message = Message::new(job, now, Uuid::new_v4(), Uuid::new_v4());
        let redis_message_id = message.options.redis_message_id.to_string();
        if let Some(key) = &message.options.debounce_key {
            pipeline
                .hset_nx(key, "enqueue_timestamp", now.as_secs())
                .hset(key, "message_id", message.message_id.to_string())
                .hset(key, "executed", 0)
                .expire(key, DEBOUNCE_KEY_TTL_SECONDS);
        }
        let encoded = serde_json::to_string(&message).expect("job messages serialize to JSON");
        pipeline
            .hset(
                format!("dramatiq:{}.msgs", message.queue_name),
                &redis_message_id,
                encoded,
            )
            .rpush(
                format!("dramatiq:{}", message.queue_name),
                &redis_message_id,
            );
    }
    pipeline.query_async::<()>(redis).await
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: Duration = Duration::from_millis(1_794_493_590_947);

    fn encode(job: Job) -> Value {
        let message = Message::new(job, NOW, Uuid::nil(), Uuid::max());
        serde_json::to_value(message).unwrap()
    }

    #[test]
    fn debounced_job_goes_to_the_delayed_queue() {
        let token_id = Uuid::from_u128(1);
        let job = Job::record_organization_access_token_usage(
            token_id,
            UNIX_EPOCH + Duration::from_millis(1_500),
        );

        assert_eq!(
            encode(job),
            json!({
                "queue_name": "low_priority.DQ",
                "actor_name": "organization_access_token.record_usage",
                "args": [],
                "kwargs": {
                    "organization_access_token_id": token_id,
                    "last_used_at": 1.5,
                },
                "options": {
                    "redis_message_id": Uuid::max(),
                    "source_correlation_id": null,
                    "debounce_key": format!(
                        "debounce:organization_access_token.record_usage:{token_id}"
                    ),
                    "eta": 1_794_493_605_947_u64,
                },
                "message_id": Uuid::nil(),
                "message_timestamp": 1_794_493_590_947_u64,
            })
        );
    }

    #[test]
    fn reducer_bucket_sync_waits_for_the_bucket_to_close() {
        let job = Job::sync_reducer_bucket(
            Uuid::from_u128(1),
            "2025-01-01T00:05:00+00:00",
            "reducer_bucket:key",
            None,
            Some("customer"),
            Duration::from_secs(120),
        );

        let message = encode(job);

        assert_eq!(message["queue_name"], "low_priority.DQ");
        assert_eq!(
            message["args"],
            json!([
                Uuid::from_u128(1),
                "2025-01-01T00:05:00+00:00",
                null,
                "customer"
            ])
        );
        assert_eq!(message["options"]["eta"], 1_794_493_710_947_u64);
        assert_eq!(
            message["options"]["debounce_key"],
            "debounce:reducer_bucket.sync:reducer_bucket:key"
        );
    }

    #[test]
    fn immediate_job_goes_to_the_main_queue() {
        let job = Job {
            actor: "dummy",
            args: vec![json!("value")],
            kwargs: Map::new(),
            delay: None,
            debounce: None,
        };

        let message = encode(job);

        assert_eq!(message["queue_name"], "low_priority");
        assert_eq!(message["args"], json!(["value"]));
        assert!(message["options"].get("eta").is_none());
        assert!(message["options"].get("debounce_key").is_none());
    }
}
