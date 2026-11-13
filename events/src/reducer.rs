use std::{cmp::Ordering, collections::BTreeMap, fmt::Write, time::Duration};

use chrono::{DateTime, Utc};
use redis::{AsyncCommands, RedisResult, aio::ConnectionManager};
use ring::digest;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::{
    event::{CustomerReference, EventCreate},
    jobs::Job,
};

const EVENT_SOURCE: &str = "user";
const ACTIVE_REDUCERS_CACHE_TTL_SECONDS: u64 = 6 * 60 * 60;
const BUCKET_SIZE_SECONDS: i64 = 5 * 60;
const BUCKET_TTL_SECONDS: i64 = 24 * 60 * 60;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct BucketId<'a> {
    reducer: usize,
    start: i64,
    customer_id: Option<Uuid>,
    external_customer_id: Option<&'a str>,
}

type Contributions<'a> = BTreeMap<BucketId<'a>, Vec<f64>>;

pub struct Rollup {
    pub bucket_count: usize,
    pub sync_jobs: Vec<Job>,
}

pub async fn rollup(
    connection: &mut PgConnection,
    redis_client: &redis::Client,
    redis: &mut ConnectionManager,
    organization_id: Uuid,
    events: &[&EventCreate],
    now: DateTime<Utc>,
) -> Result<Rollup, sqlx::Error> {
    let mut reducers = active_reducers(connection, redis_client, redis, organization_id).await?;
    reducers.retain(|reducer| !matches!(reducer.aggregation, Aggregation::Unique));
    let contributions = reduce_events(&reducers, events);

    let current_bucket_start = bucket_start(now.timestamp());
    let oldest_active_bucket_start = current_bucket_start - BUCKET_SIZE_SECONDS;
    let active = Vec::from_iter(
        contributions
            .iter()
            .filter(|(bucket, _)| bucket.start >= oldest_active_bucket_start),
    );
    if !active.is_empty() {
        match add_to_buckets(redis, &reducers, &active).await {
            Ok(()) => tracing::info!(
                %organization_id,
                bucket_count = active.len(),
                event_count = events.len(),
                "active reducer buckets updated in Redis"
            ),
            Err(error) => tracing::error!(
                %error,
                %organization_id,
                bucket_count = active.len(),
                event_count = events.len(),
                "failed to update active reducer buckets in Redis"
            ),
        }
    }

    // TODO: contributions to buckets before `current_bucket_start` must also be written to
    // `reducer_buckets`, as `ReducerService._add_to_closed_buckets` does.

    let sync_jobs = Vec::from_iter(
        contributions
            .keys()
            .filter(|bucket| bucket.start >= current_bucket_start)
            .map(|bucket| {
                let closes_in = bucket.start + BUCKET_SIZE_SECONDS - now.timestamp();
                Job::sync_reducer_bucket(
                    reducers[bucket.reducer].id,
                    &bucket_start_isoformat(bucket.start),
                    &bucket_key(reducers[bucket.reducer].id, bucket),
                    bucket.customer_id,
                    bucket.external_customer_id,
                    Duration::from_secs(closes_in.max(0) as u64),
                )
            }),
    );
    Ok(Rollup {
        bucket_count: contributions.len(),
        sync_jobs,
    })
}

fn bucket_start(unix_seconds: i64) -> i64 {
    unix_seconds - unix_seconds.rem_euclid(BUCKET_SIZE_SECONDS)
}

fn bucket_start_isoformat(start: i64) -> String {
    DateTime::from_timestamp(start, 0)
        .expect("bucket starts come from timestamps chrono already represents")
        .format("%Y-%m-%dT%H:%M:%S+00:00")
        .to_string()
}

fn bucket_key(reducer_id: Uuid, bucket: &BucketId) -> String {
    let mut key = format!("reducer_bucket:{reducer_id}:{}:", bucket.start);
    match bucket.customer_id {
        Some(customer_id) => write!(key, "{customer_id}"),
        None => write!(key, "-"),
    }
    .expect("writing to a String cannot fail");
    if let Some(external_customer_id) = bucket.external_customer_id {
        key.push(':');
        for byte in digest::digest(&digest::SHA256, external_customer_id.as_bytes()).as_ref() {
            write!(key, "{byte:02x}").expect("writing to a String cannot fail");
        }
    }
    key
}

fn reduce_events<'a>(reducers: &[Reducer], events: &[&'a EventCreate]) -> Contributions<'a> {
    let mut contributions = Contributions::new();
    for event in events {
        let start = bucket_start(unix_seconds(event));
        let (customer_id, external_customer_id) = match &event.customer {
            CustomerReference::Polar { customer_id, .. } => (Some(*customer_id), None),
            CustomerReference::External {
                external_customer_id,
                ..
            } => (None, Some(external_customer_id.as_str())),
        };
        for (reducer, definition) in reducers.iter().enumerate() {
            if !definition.filter.matches(event) {
                continue;
            }
            let Some(value) = definition.aggregation.value(event) else {
                continue;
            };
            contributions
                .entry(BucketId {
                    reducer,
                    start,
                    customer_id,
                    external_customer_id,
                })
                .or_default()
                .push(value);
        }
    }
    contributions
}

async fn add_to_buckets(
    redis: &mut ConnectionManager,
    reducers: &[Reducer],
    contributions: &[(&BucketId<'_>, &Vec<f64>)],
) -> RedisResult<()> {
    let mut pipeline = redis::pipe();
    for (bucket, values) in contributions {
        let reducer = &reducers[bucket.reducer];
        let key = bucket_key(reducer.id, bucket);
        // ponytail: Python sums as Decimal before converting; summing floats can differ in the
        // last digit. These buckets are replaced by the Postgres sync once they close.
        let sum: f64 = values.iter().sum();
        match reducer.aggregation {
            Aggregation::Count => pipeline.incr(&key, values.len()),
            Aggregation::Sum { .. } => pipeline.incr(&key, sum),
            Aggregation::Avg { .. } => pipeline
                .hincr(&key, "count", values.len())
                .hincr(&key, "sum", sum),
            Aggregation::Min { .. } => pipeline
                .cmd("ZADD")
                .arg(&key)
                .arg("LT")
                .arg(values.iter().copied().fold(f64::INFINITY, f64::min))
                .arg("min"),
            Aggregation::Max { .. } => pipeline
                .cmd("ZADD")
                .arg(&key)
                .arg("GT")
                .arg(values.iter().copied().fold(f64::NEG_INFINITY, f64::max))
                .arg("max"),
            Aggregation::Unique => continue,
        };
        pipeline
            .cmd("EXPIRE")
            .arg(&key)
            .arg(BUCKET_TTL_SECONDS)
            .arg("NX");
    }
    pipeline.query_async(redis).await
}

#[derive(Debug, Deserialize)]
struct Reducer {
    id: Uuid,
    filter: Filter,
    aggregation: Aggregation,
}

fn active_reducers_cache_key(organization_id: Uuid) -> String {
    format!("reducers:active:v2:{organization_id}")
}

async fn active_reducers(
    connection: &mut PgConnection,
    redis_client: &redis::Client,
    redis: &mut ConnectionManager,
    organization_id: Uuid,
) -> Result<Vec<Reducer>, sqlx::Error> {
    let key = active_reducers_cache_key(organization_id);
    let cached: RedisResult<Option<String>> = redis.get(&key).await;
    let refill = match cached {
        Ok(Some(cached)) if !cached.is_empty() => match serde_json::from_str(&cached) {
            Ok(reducers) => return Ok(reducers),
            Err(error) => {
                tracing::error!(
                    line = error.line(),
                    column = error.column(),
                    "cached active reducers are invalid"
                );
                false
            }
        },
        Ok(_) => true,
        Err(error) => {
            tracing::error!(%error, "failed to read cached active reducers");
            false
        }
    };
    if !refill {
        return parse_reducers(select_active_reducers(connection, organization_id).await?);
    }

    // WATCH is per connection: the shared multiplexed one would leak it to other requests.
    let watcher = async {
        let mut watcher = redis_client.get_multiplexed_async_connection().await?;
        redis::cmd("WATCH")
            .arg(&key)
            .query_async::<()>(&mut watcher)
            .await?;
        Ok::<_, redis::RedisError>(watcher)
    }
    .await;
    let active = select_active_reducers(connection, organization_id).await?;
    let stored = match watcher {
        Ok(mut watcher) => {
            redis::pipe()
                .atomic()
                .set_ex(&key, active.to_string(), ACTIVE_REDUCERS_CACHE_TTL_SECONDS)
                .query_async::<Option<()>>(&mut watcher)
                .await
        }
        Err(error) => Err(error),
    };
    if let Err(error) = stored {
        tracing::error!(%error, "failed to cache active reducers");
    }
    parse_reducers(active)
}

async fn select_active_reducers(
    connection: &mut PgConnection,
    organization_id: Uuid,
) -> Result<Value, sqlx::Error> {
    let rows: Vec<(Uuid, Value, Value)> = sqlx::query_as(
        "SELECT reducers.id, reducers.filter, reducers.aggregation \
         FROM reducers \
         WHERE reducers.kind = 'usage' AND reducers.id IN (\
             SELECT meter_reducers.reducer_id \
             FROM meter_reducers JOIN meters ON meters.id = meter_reducers.meter_id \
             WHERE meters.archived_at IS NULL AND meters.deleted_at IS NULL AND (\
                 meters.is_current OR NOT EXISTS (\
                     SELECT catalogs.id FROM catalogs \
                     WHERE catalogs.id = meters.catalog_id AND catalogs.status = 'draft'\
                 )\
             )\
         ) AND reducers.organization_id = $1",
    )
    .bind(organization_id)
    .fetch_all(connection)
    .await?;
    Ok(Value::Array(Vec::from_iter(rows.into_iter().map(
        |(id, filter, aggregation)| {
            json!({
                "id": id,
                "organization_id": organization_id,
                "kind": "usage",
                "filter": filter,
                "aggregation": aggregation,
            })
        },
    ))))
}

fn parse_reducers(reducers: Value) -> Result<Vec<Reducer>, sqlx::Error> {
    serde_json::from_value(reducers).map_err(|error| sqlx::Error::Decode(error.into()))
}

#[derive(Debug, Deserialize)]
struct Filter {
    conjunction: Conjunction,
    clauses: Vec<Clause>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Conjunction {
    And,
    Or,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum Clause {
    Condition(Condition),
    Group(Filter),
}

#[derive(Debug, Deserialize)]
struct Condition {
    property: String,
    operator: Operator,
    value: ConditionValue,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
enum Operator {
    Eq,
    Ne,
    Gt,
    Gte,
    Lt,
    Lte,
    Like,
    NotLike,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ConditionValue {
    Bool(bool),
    Integer(i64),
    Text(String),
}

#[derive(Debug, Deserialize)]
#[serde(tag = "func", rename_all = "lowercase")]
enum Aggregation {
    Count,
    Sum { property: String },
    Max { property: String },
    Min { property: String },
    Avg { property: String },
    Unique,
}

fn strip_metadata_prefix(property: &str) -> &str {
    property.strip_prefix("metadata.").unwrap_or(property)
}

fn unix_seconds(event: &EventCreate) -> i64 {
    let seconds = event.timestamp.timestamp();
    if seconds < 0 && event.timestamp.timestamp_subsec_nanos() > 0 {
        seconds + 1
    } else {
        seconds
    }
}

fn nested_metadata_value<'a>(metadata: &'a Map<String, Value>, path: &str) -> Option<&'a Value> {
    if path.is_empty() {
        return None;
    }
    let mut parts = path.split('.');
    let mut value = metadata.get(parts.next()?)?;
    for part in parts {
        value = value.as_object()?.get(part)?;
    }
    Some(value).filter(|value| !value.is_null())
}

impl Filter {
    fn matches(&self, event: &EventCreate) -> bool {
        let mut clauses = self.clauses.iter().map(|clause| match clause {
            Clause::Condition(condition) => condition.matches(event),
            Clause::Group(filter) => filter.matches(event),
        });
        match self.conjunction {
            Conjunction::And => clauses.all(|matched| matched),
            Conjunction::Or => self.clauses.is_empty() || clauses.any(|matched| matched),
        }
    }
}

impl Condition {
    fn matches(&self, event: &EventCreate) -> bool {
        match (strip_metadata_prefix(&self.property), &self.value) {
            ("name", ConditionValue::Text(expected)) => self.compare_text(&event.name, expected),
            ("source", ConditionValue::Text(expected)) => self.compare_text(EVENT_SOURCE, expected),
            ("timestamp", ConditionValue::Integer(expected)) => {
                self.compare_ordering(Some(unix_seconds(event).cmp(expected)))
            }
            ("name" | "source" | "timestamp", _) => false,
            (property, expected) => nested_metadata_value(&event.metadata, property)
                .is_some_and(|actual| self.compare(actual, expected)),
        }
    }

    fn compare(&self, actual: &Value, expected: &ConditionValue) -> bool {
        match (actual, expected) {
            (Value::Bool(actual), ConditionValue::Bool(expected)) => {
                self.compare_ordering(Some(actual.cmp(expected)))
            }
            (Value::Bool(_), _) | (_, ConditionValue::Bool(_)) => self.operator == Operator::Ne,
            (Value::String(actual), ConditionValue::Text(expected)) => {
                self.compare_text(actual, expected)
            }
            (Value::Number(actual), ConditionValue::Integer(expected)) => {
                let ordering = match actual.as_i64() {
                    Some(actual) => Some(actual.cmp(expected)),
                    None => actual
                        .as_f64()
                        .and_then(|actual| actual.partial_cmp(&(*expected as f64))),
                };
                self.compare_ordering(ordering)
            }
            _ => self.operator == Operator::Ne,
        }
    }

    fn compare_text(&self, actual: &str, expected: &str) -> bool {
        match self.operator {
            Operator::Like => actual.contains(expected),
            Operator::NotLike => !actual.contains(expected),
            _ => self.compare_ordering(Some(actual.cmp(expected))),
        }
    }

    fn compare_ordering(&self, ordering: Option<Ordering>) -> bool {
        let Some(ordering) = ordering else {
            return self.operator == Operator::Ne;
        };
        match self.operator {
            Operator::Eq => ordering.is_eq(),
            Operator::Ne => ordering.is_ne(),
            Operator::Gt => ordering.is_gt(),
            Operator::Gte => ordering.is_ge(),
            Operator::Lt => ordering.is_lt(),
            Operator::Lte => ordering.is_le(),
            Operator::Like | Operator::NotLike => false,
        }
    }
}

impl Aggregation {
    fn value(&self, event: &EventCreate) -> Option<f64> {
        let property = match self {
            Self::Count => return Some(1.0),
            Self::Unique => return None,
            Self::Sum { property }
            | Self::Max { property }
            | Self::Min { property }
            | Self::Avg { property } => strip_metadata_prefix(property),
        };
        match property {
            "timestamp" => Some(unix_seconds(event) as f64),
            "name" | "source" => None,
            property => nested_metadata_value(&event.metadata, property)?.as_f64(),
        }
    }
}

#[cfg(test)]
mod tests {
    use sqlx::Connection;

    use super::*;

    fn fixture() -> (Value, EventCreate) {
        let cases: Value =
            serde_json::from_str(include_str!("../tests/fixtures/reducer_cases.json")).unwrap();
        let event = &cases["event"];
        let event = EventCreate {
            timestamp: event["timestamp"].as_str().unwrap().parse().unwrap(),
            name: event["name"].as_str().unwrap().to_owned(),
            organization_id: None,
            external_id: None,
            parent_id: None,
            metadata: event["metadata"].as_object().unwrap().clone(),
            customer: CustomerReference::External {
                external_customer_id: "customer".to_owned(),
                external_member_id: None,
            },
        };
        (cases, event)
    }

    #[test]
    fn filters_match_like_python() {
        let (cases, event) = fixture();
        let failures: Vec<String> = cases["filters"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|case| {
                let filter: Filter = serde_json::from_value(case["filter"].clone()).unwrap();
                let matches = filter.matches(&event);
                (Value::Bool(matches) != case["matches"])
                    .then(|| format!("{} matched {matches}", case["filter"]))
            })
            .collect();

        assert!(failures.is_empty(), "{}", failures.join("\n"));
    }

    #[test]
    fn aggregations_extract_values_like_python() {
        let (cases, event) = fixture();
        let failures: Vec<String> = cases["aggregations"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|case| {
                let aggregation: Aggregation =
                    serde_json::from_value(case["aggregation"].clone()).unwrap();
                let value = aggregation.value(&event);
                let expected = match &aggregation {
                    Aggregation::Count => Some(1.0),
                    _ => case["value"].as_f64(),
                };
                (value != expected).then(|| format!("{} gave {value:?}", case["aggregation"]))
            })
            .collect();

        assert!(failures.is_empty(), "{}", failures.join("\n"));
    }

    #[tokio::test]
    #[ignore = "needs the local development database and Redis"]
    async fn loads_active_reducers_through_the_cache() {
        let config = crate::config::Config::from_env().unwrap();
        let mut connection = sqlx::PgConnection::connect_with(&config.postgres)
            .await
            .unwrap();
        let client = redis::Client::open(config.redis_url).unwrap();
        let mut redis = ConnectionManager::new(client.clone()).await.unwrap();
        let organization_id = Uuid::new_v4();
        let key = active_reducers_cache_key(organization_id);
        let python_cached = format!(
            r#"[{{"id":"{}","organization_id":"{organization_id}","kind":"usage","filter":{{"conjunction":"and","clauses":[{{"property":"model","operator":"eq","value":"x"}}]}},"aggregation":{{"func":"sum","property":"tokens"}}}}]"#,
            Uuid::new_v4()
        );

        let missing = active_reducers(&mut connection, &client, &mut redis, organization_id)
            .await
            .unwrap();
        let refilled: String = redis.get(&key).await.unwrap();
        let _: () = redis.set(&key, "").await.unwrap();
        let invalidated = active_reducers(&mut connection, &client, &mut redis, organization_id)
            .await
            .unwrap();
        let _: () = redis.set(&key, &python_cached).await.unwrap();
        let cached = active_reducers(&mut connection, &client, &mut redis, organization_id)
            .await
            .unwrap();
        let _: () = redis.del(&key).await.unwrap();

        assert!(missing.is_empty() && invalidated.is_empty());
        assert_eq!(refilled, "[]");
        assert_eq!(cached.len(), 1);
        assert!(matches!(cached[0].aggregation, Aggregation::Sum { .. }));
    }

    fn reducer(id: u128, aggregation: Value) -> Reducer {
        serde_json::from_value(json!({
            "id": Uuid::from_u128(id),
            "filter": {
                "conjunction": "and",
                "clauses": [{ "property": "name", "operator": "eq", "value": "api.call" }],
            },
            "aggregation": aggregation,
        }))
        .unwrap()
    }

    #[test]
    fn builds_bucket_keys_like_python() {
        let bucket = BucketId {
            reducer: 0,
            start: bucket_start(1_735_690_050),
            customer_id: Some(Uuid::from_u128(2)),
            external_customer_id: None,
        };
        let external = BucketId {
            customer_id: None,
            external_customer_id: Some("customer-é"),
            ..bucket
        };

        assert_eq!(
            bucket_start_isoformat(bucket.start),
            "2025-01-01T00:05:00+00:00"
        );
        assert_eq!(
            bucket_key(Uuid::from_u128(1), &bucket),
            "reducer_bucket:00000000-0000-0000-0000-000000000001:1735689900:00000000-0000-0000-0000-000000000002"
        );
        assert_eq!(
            bucket_key(Uuid::from_u128(1), &external),
            "reducer_bucket:00000000-0000-0000-0000-000000000001:1735689900:-:6ef1565500e4024c51dede0b5d55f8b6f00bf0f90055718b4e82f6e193ffd665"
        );
    }

    #[test]
    fn groups_matching_events_by_reducer_bucket_and_customer() {
        let (_, event) = fixture();
        let mut other_name = fixture().1;
        other_name.name = "other".to_owned();
        let mut later = fixture().1;
        later.timestamp += chrono::TimeDelta::minutes(5);
        let reducers = [
            reducer(1, json!({ "func": "count" })),
            reducer(2, json!({ "func": "sum", "property": "tokens" })),
            reducer(3, json!({ "func": "sum", "property": "model" })),
        ];

        let contributions = reduce_events(&reducers, &[&event, &event, &other_name, &later]);
        let summary = Vec::from_iter(
            contributions
                .iter()
                .map(|(bucket, values)| (bucket.reducer, bucket.start, values.clone())),
        );

        assert_eq!(
            summary,
            [
                (0, 1_735_689_600, vec![1.0, 1.0]),
                (0, 1_735_689_900, vec![1.0]),
                (1, 1_735_689_600, vec![12.0, 12.0]),
                (1, 1_735_689_900, vec![12.0]),
            ]
        );
    }

    #[tokio::test]
    #[ignore = "needs the local development Redis"]
    async fn adds_contributions_to_redis_buckets() {
        let config = crate::config::Config::from_env().unwrap();
        let client = redis::Client::open(config.redis_url).unwrap();
        let mut redis = ConnectionManager::new(client).await.unwrap();
        let id = Uuid::new_v4().as_u128();
        let reducers = [
            reducer(id, json!({ "func": "count" })),
            reducer(id + 1, json!({ "func": "sum", "property": "tokens" })),
            reducer(id + 2, json!({ "func": "avg", "property": "tokens" })),
            reducer(id + 3, json!({ "func": "min", "property": "tokens" })),
            reducer(id + 4, json!({ "func": "max", "property": "tokens" })),
        ];
        let buckets = Vec::from_iter((0..reducers.len()).map(|reducer| BucketId {
            reducer,
            start: 1_735_689_600,
            customer_id: None,
            external_customer_id: Some("customer"),
        }));
        let keys = Vec::from_iter(
            buckets
                .iter()
                .map(|bucket| bucket_key(reducers[bucket.reducer].id, bucket)),
        );
        let first = vec![3.0, 1.5];
        let second = vec![2.0];

        for values in [&first, &second] {
            let contributions = Vec::from_iter(buckets.iter().map(|bucket| (bucket, values)));
            add_to_buckets(&mut redis, &reducers, &contributions)
                .await
                .unwrap();
        }
        let count: i64 = redis.get(&keys[0]).await.unwrap();
        let sum: f64 = redis.get(&keys[1]).await.unwrap();
        let average: (i64, f64) = redis.hmget(&keys[2], &["count", "sum"]).await.unwrap();
        let minimum: f64 = redis.zscore(&keys[3], "min").await.unwrap();
        let maximum: f64 = redis.zscore(&keys[4], "max").await.unwrap();
        let ttl: i64 = redis.ttl(&keys[0]).await.unwrap();
        let _: () = redis.del(&keys).await.unwrap();

        assert_eq!((count, sum, average), (3, 6.5, (3, 6.5)));
        assert_eq!((minimum, maximum), (1.5, 3.0));
        assert!(ttl > BUCKET_TTL_SECONDS - 60);
    }

    #[test]
    fn truncates_negative_timestamps_towards_zero() {
        let (_, mut event) = fixture();
        event.timestamp = "1969-12-31T23:59:59.500Z".parse().unwrap();

        assert_eq!(unix_seconds(&event), 0);
    }
}
