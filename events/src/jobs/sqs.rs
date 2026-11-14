use std::{collections::HashSet, fmt::Write, time::Duration};

use anyhow::{Context, anyhow, bail};
use aws_config::{SdkConfig, retry::RetryConfig, timeout::TimeoutConfig};
use aws_sdk_sqs::{
    Client, config::Builder, error::DisplayErrorContext, types::SendMessageBatchRequestEntry,
};
use redis::aio::ConnectionManager;
use serde::Serialize;
use serde_json::{Map, Value};
use uuid::Uuid;

use super::{Job, QUEUE, set_debounce};

const BATCH_SIZE: usize = 10;
const MAX_BATCH_BYTES: usize = 262_144;
const MAX_DELAY_SECONDS: u64 = 900;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(2);
const READ_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_ATTEMPTS: u32 = 3;

pub struct SqsSettings {
    pub queue_prefix: String,
    pub actors: Option<HashSet<String>>,
    pub endpoint_url: Option<String>,
}

pub struct SqsQueue {
    client: Client,
    actors: Option<HashSet<String>>,
    queue_url: String,
}

#[derive(Serialize)]
struct Envelope {
    actor: &'static str,
    args: Vec<Value>,
    kwargs: Map<String, Value>,
    correlation_id: Option<String>,
    attempt: u32,
    message_timestamp: u64,
    message_id: Uuid,
    debounce_key: Option<String>,
    message_options: Map<String, Value>,
}

impl Envelope {
    fn new(job: Job, now: Duration, message_id: Uuid) -> (Self, Option<Duration>) {
        let delay = job.effective_delay();
        let envelope = Self {
            debounce_key: job.debounce_key(),
            actor: job.actor,
            args: job.args,
            kwargs: job.kwargs,
            correlation_id: None,
            attempt: 1,
            message_timestamp: now.as_millis() as u64,
            message_id,
            message_options: Map::new(),
        };
        (envelope, delay)
    }
}

impl SqsQueue {
    pub async fn connect(sdk_config: &SdkConfig, settings: SqsSettings) -> anyhow::Result<Self> {
        let mut builder = Builder::from(sdk_config)
            .timeout_config(
                TimeoutConfig::builder()
                    .connect_timeout(CONNECT_TIMEOUT)
                    .read_timeout(READ_TIMEOUT)
                    .build(),
            )
            .retry_config(RetryConfig::standard().with_max_attempts(MAX_ATTEMPTS));
        if let Some(endpoint_url) = settings.endpoint_url {
            builder = builder.endpoint_url(endpoint_url);
        }
        let client = Client::from_conf(builder.build());
        let queue_name = format!("{}-{}", settings.queue_prefix, QUEUE.replace('_', "-"));
        let queue_url = client
            .get_queue_url()
            .queue_name(&queue_name)
            .send()
            .await
            .with_context(|| format!("looking up SQS queue {queue_name}"))?
            .queue_url
            .ok_or_else(|| anyhow!("SQS returned no URL for queue {queue_name}"))?;
        Ok(Self {
            client,
            actors: settings.actors,
            queue_url,
        })
    }

    pub fn accepts(&self, actor: &str) -> bool {
        self.actors
            .as_ref()
            .is_none_or(|actors| actors.contains(actor))
    }

    pub(super) async fn send(
        &self,
        redis: &mut ConnectionManager,
        jobs: Vec<Job>,
        now: Duration,
    ) -> anyhow::Result<()> {
        let mut batches: Vec<Vec<QueuedJob>> = vec![Vec::new()];
        let mut batch_bytes = 0;
        for job in jobs {
            let (envelope, delay) = Envelope::new(job, now, Uuid::new_v4());
            let body = ensure_ascii(
                &serde_json::to_string(&envelope).expect("job envelopes serialize to JSON"),
            );
            let batch = batches.last().expect("there is always a current batch");
            if !batch.is_empty()
                && (batch.len() >= BATCH_SIZE || batch_bytes + body.len() > MAX_BATCH_BYTES)
            {
                batches.push(Vec::new());
                batch_bytes = 0;
            }
            batch_bytes += body.len();
            let batch = batches.last_mut().expect("there is always a current batch");
            let entry = SendMessageBatchRequestEntry::builder()
                .id(batch.len().to_string())
                .message_body(body)
                .set_delay_seconds(delay.map(|delay| delay.as_secs().min(MAX_DELAY_SECONDS) as i32))
                .build()
                .context("building an SQS batch entry")?;
            batch.push(QueuedJob {
                entry,
                message_id: envelope.message_id,
                debounce_key: envelope.debounce_key,
            });
        }

        let mut rejected = Vec::new();
        for batch in batches {
            let (entries, owners): (Vec<_>, Vec<_>) = batch
                .into_iter()
                .map(|job| (job.entry, (job.message_id, job.debounce_key)))
                .unzip();
            let sent = match self
                .client
                .send_message_batch()
                .queue_url(&self.queue_url)
                .set_entries(Some(entries))
                .send()
                .await
            {
                Ok(sent) => sent,
                Err(error) => {
                    rejected.push(format!(
                        "{} job(s): {}",
                        owners.len(),
                        DisplayErrorContext(&error)
                    ));
                    continue;
                }
            };
            rejected.extend(sent.failed().iter().map(|failed| failed.code().to_owned()));

            // A job owns its debounce key only once SQS has it: a job that was never queued
            // must not make the worker skip the one queued before it.
            let mut debounces = redis::pipe();
            debounces.atomic();
            for queued in sent.successful() {
                let owner = queued
                    .id()
                    .parse::<usize>()
                    .ok()
                    .and_then(|id| owners.get(id));
                if let Some((message_id, Some(key))) = owner {
                    set_debounce(&mut debounces, key, *message_id, now);
                }
            }
            if let Err(error) = debounces.query_async::<()>(redis).await {
                rejected.push(format!("debounce keys not written: {error}"));
            }
        }
        if !rejected.is_empty() {
            bail!("SQS did not accept every job: {}", rejected.join(", "));
        }
        Ok(())
    }
}

struct QueuedJob {
    entry: SendMessageBatchRequestEntry,
    message_id: Uuid,
    debounce_key: Option<String>,
}

fn ensure_ascii(json: &str) -> String {
    let mut ascii = String::with_capacity(json.len());
    for character in json.chars() {
        if character.is_ascii() && character != '\x7f' {
            ascii.push(character);
        } else {
            for unit in character.encode_utf16(&mut [0; 2]) {
                write!(ascii, "\\u{unit:04x}").expect("writing to a String cannot fail");
            }
        }
    }
    ascii
}

#[cfg(test)]
mod tests {
    use std::{
        net::Ipv4Addr,
        sync::{Arc, Mutex},
    };

    use axum::{
        Router,
        extract::State,
        http::{
            HeaderMap,
            header::{CONTENT_TYPE, HeaderName},
        },
    };
    use redis::AsyncCommands;
    use serde_json::json;
    use tokio::net::TcpListener;

    use super::*;
    use crate::aws::{AwsSettings, sdk_config};

    type Requests = Arc<Mutex<Vec<(String, Value)>>>;

    async fn mock_sqs(
        State(requests): State<Requests>,
        headers: HeaderMap,
        body: String,
    ) -> ([(HeaderName, &'static str); 1], String) {
        let target = headers["x-amz-target"].to_str().unwrap().to_owned();
        let body: Value = serde_json::from_str(&body).unwrap();
        let response = match target.as_str() {
            "AmazonSQS.GetQueueUrl" => json!({ "QueueUrl": "http://sqs.test/1/queue" }),
            _ => json!({
                "Failed": Vec::from_iter(
                    body["Entries"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .filter(|entry| is_rejected(entry))
                        .map(|entry| json!({
                            "Id": entry["Id"],
                            "SenderFault": true,
                            "Code": "InvalidMessageContents",
                        })),
                ),
                "Successful": Vec::from_iter(body["Entries"].as_array().unwrap().iter().filter(|entry| !is_rejected(entry)).map(
                    |entry| json!({
                        "Id": entry["Id"],
                        "MessageId": "message",
                        "MD5OfMessageBody": "",
                    }),
                )),
            }),
        };
        requests.lock().unwrap().push((target, body));
        (
            [(CONTENT_TYPE, "application/x-amz-json-1.0")],
            response.to_string(),
        )
    }

    fn is_rejected(entry: &Value) -> bool {
        entry["MessageBody"].as_str().unwrap().contains("rejected")
    }

    async fn mock_queue(actors: &[&str]) -> (SqsQueue, Requests, ConnectionManager) {
        let requests = Requests::default();
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.unwrap();
        let endpoint_url = format!("http://{}", listener.local_addr().unwrap());
        let mock = Router::new()
            .fallback(mock_sqs)
            .with_state(requests.clone());
        tokio::spawn(async move { axum::serve(listener, mock).await });
        let config = crate::config::Config::from_env().unwrap();
        let redis = ConnectionManager::new(redis::Client::open(config.redis_url).unwrap())
            .await
            .unwrap();
        let sdk_config = sdk_config(&AwsSettings {
            region: "us-east-2".to_owned(),
            static_credentials: Some(("key".to_owned(), "secret".to_owned())),
        })
        .await;
        let queue = SqsQueue::connect(
            &sdk_config,
            SqsSettings {
                queue_prefix: "polar-tasks".to_owned(),
                actors: Some(HashSet::from_iter(
                    actors.iter().map(|actor| (*actor).to_owned()),
                )),
                endpoint_url: Some(endpoint_url),
            },
        )
        .await
        .unwrap();
        (queue, requests, redis)
    }

    fn sync_job(bucket_key: &str) -> Job {
        Job::sync_reducer_bucket(
            Uuid::from_u128(1),
            "2025-01-01T00:05:00+00:00",
            bucket_key,
            None,
            Some("customer"),
            Duration::from_secs(1_200),
        )
    }

    #[tokio::test]
    #[ignore = "needs the local development Redis"]
    async fn leaves_the_debounce_key_alone_when_a_job_is_rejected() {
        let (queue, _, mut redis) = mock_queue(&["reducer_bucket.sync"]).await;
        let accepted = format!("reducer_bucket:{}", Uuid::new_v4());
        let rejected = format!("reducer_bucket:rejected:{}", Uuid::new_v4());
        let accepted_key = format!("debounce:reducer_bucket.sync:{accepted}");
        let rejected_key = format!("debounce:reducer_bucket.sync:{rejected}");
        let _: () = redis
            .hset(&rejected_key, "message_id", "previous")
            .await
            .unwrap();

        let result = queue
            .send(
                &mut redis,
                vec![sync_job(&rejected), sync_job(&accepted)],
                Duration::from_millis(1_794_493_590_947),
            )
            .await;
        let accepted_owner: Option<String> = redis.hget(&accepted_key, "message_id").await.unwrap();
        let rejected_owner: String = redis.hget(&rejected_key, "message_id").await.unwrap();
        let _: () = redis.del(&[&accepted_key, &rejected_key]).await.unwrap();

        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("InvalidMessageContents")
        );
        assert!(accepted_owner.is_some());
        assert_eq!(rejected_owner, "previous");
    }

    #[tokio::test]
    #[ignore = "needs the local development Redis"]
    async fn accepts_only_the_actors_routed_to_it() {
        let (queue, ..) = mock_queue(&["reducer_bucket.sync"]).await;

        assert!(queue.accepts("reducer_bucket.sync"));
        assert!(!queue.accepts("organization_access_token.record_usage"));
    }

    #[test]
    fn escapes_non_ascii_like_python() {
        assert_eq!(
            ensure_ascii("{\"a\":\"é\u{ffff}😀\u{7f}\\n\"}"),
            "{\"a\":\"\\u00e9\\uffff\\ud83d\\ude00\\u007f\\n\"}"
        );
    }

    #[tokio::test]
    #[ignore = "needs the local development Redis"]
    async fn sends_delayed_debounced_jobs_to_the_queue() {
        let (queue, requests, mut redis) = mock_queue(&["reducer_bucket.sync"]).await;
        let bucket_key = format!("reducer_bucket:{}", Uuid::new_v4());
        let jobs = Vec::from_iter((0..11).map(|_| sync_job(&bucket_key)));

        queue
            .send(&mut redis, jobs, Duration::from_millis(1_794_493_590_947))
            .await
            .unwrap();
        let debounce_key = format!("debounce:reducer_bucket.sync:{bucket_key}");
        let owner: String = redis.hget(&debounce_key, "message_id").await.unwrap();
        let _: () = redis.del(&debounce_key).await.unwrap();

        let requests = requests.lock().unwrap();
        let targets = Vec::from_iter(requests.iter().map(|(target, _)| target.as_str()));
        assert_eq!(
            targets,
            [
                "AmazonSQS.GetQueueUrl",
                "AmazonSQS.SendMessageBatch",
                "AmazonSQS.SendMessageBatch",
            ]
        );
        assert_eq!(requests[0].1["QueueName"], "polar-tasks-low-priority");
        assert_eq!(requests[1].1["QueueUrl"], "http://sqs.test/1/queue");
        let first = requests[1].1["Entries"].as_array().unwrap();
        let last = requests[2].1["Entries"].as_array().unwrap();
        assert_eq!((first.len(), last.len()), (10, 1));
        assert_eq!(first[9]["Id"], "9");
        assert_eq!(first[0]["DelaySeconds"], 900);
        let envelope: Value =
            serde_json::from_str(last[0]["MessageBody"].as_str().unwrap()).unwrap();
        assert_eq!(envelope["actor"], "reducer_bucket.sync");
        assert_eq!(envelope["debounce_key"], debounce_key);
        assert_eq!(envelope["message_id"], owner);
    }

    #[test]
    fn builds_the_envelope_the_lambda_worker_parses() {
        let job = Job::sync_reducer_bucket(
            Uuid::from_u128(1),
            "2025-01-01T00:05:00+00:00",
            "reducer_bucket:key",
            None,
            Some("customer"),
            Duration::from_secs(120),
        );

        let (envelope, delay) =
            Envelope::new(job, Duration::from_millis(1_794_493_590_947), Uuid::nil());

        assert_eq!(delay, Some(Duration::from_secs(120)));
        assert_eq!(
            serde_json::to_value(envelope).unwrap(),
            json!({
                "actor": "reducer_bucket.sync",
                "args": [
                    "00000000-0000-0000-0000-000000000001",
                    "2025-01-01T00:05:00+00:00",
                    null,
                    "customer",
                ],
                "kwargs": {},
                "correlation_id": null,
                "attempt": 1,
                "message_timestamp": 1_794_493_590_947_u64,
                "message_id": "00000000-0000-0000-0000-000000000000",
                "debounce_key": "debounce:reducer_bucket.sync:reducer_bucket:key",
                "message_options": {},
            })
        );
    }
}
