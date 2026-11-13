mod cache;
mod closed_buckets;
mod filter;
mod redis_store;

use std::{collections::BTreeMap, time::Duration};

use chrono::{DateTime, Utc};
use redis::aio::ConnectionManager;
use serde::Deserialize;
use sqlx::PgConnection;
use uuid::Uuid;

use self::{
    cache::active_reducers,
    closed_buckets::add_to_closed_buckets,
    filter::{Aggregation, Filter, unix_seconds},
    redis_store::{add_to_buckets, bucket_key},
};
use crate::{
    event::{CustomerReference, EventCreate},
    jobs::Job,
    outpost::ReducerBucketChange,
};

const BUCKET_SIZE_SECONDS: i64 = 5 * 60;

#[derive(Debug, Deserialize)]
struct Reducer {
    id: Uuid,
    filter: Filter,
    aggregation: Aggregation,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct BucketId<'a> {
    reducer: usize,
    start: i64,
    customer_id: Option<Uuid>,
    external_customer_id: Option<&'a str>,
}

type TimedValues = Vec<(DateTime<Utc>, f64)>;
type Contributions<'a> = BTreeMap<BucketId<'a>, TimedValues>;

pub struct Rollup {
    pub bucket_count: usize,
    pub sync_jobs: Vec<Job>,
    pub outpost_changes: Vec<ReducerBucketChange>,
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
    let closed = Vec::from_iter(
        contributions
            .iter()
            .filter(|(bucket, _)| bucket.start < current_bucket_start),
    );
    let outpost_changes = Vec::from_iter(closed.iter().map(|(bucket, _)| ReducerBucketChange {
        reducer_id: reducers[bucket.reducer].id,
        customer_id: bucket.customer_id,
        external_customer_id: bucket.external_customer_id.map(str::to_owned),
    }));
    add_to_closed_buckets(connection, organization_id, &reducers, closed).await?;

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
        outpost_changes,
    })
}

fn bucket_start(unix_seconds: i64) -> i64 {
    unix_seconds - unix_seconds.rem_euclid(BUCKET_SIZE_SECONDS)
}

fn bucket_start_datetime(start: i64) -> DateTime<Utc> {
    DateTime::from_timestamp(start, 0)
        .expect("bucket starts come from timestamps chrono already represents")
}

fn bucket_start_isoformat(start: i64) -> String {
    bucket_start_datetime(start)
        .format("%Y-%m-%dT%H:%M:%S+00:00")
        .to_string()
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
                .push((event.timestamp, value));
        }
    }
    contributions
}

#[cfg(test)]
mod tests {
    use redis::AsyncCommands;
    use serde_json::{Value, json};
    use sqlx::Connection;

    use super::{cache::active_reducers_cache_key, redis_store::BUCKET_TTL_SECONDS, *};

    fn fixture() -> (Value, EventCreate) {
        let cases: Value =
            serde_json::from_str(include_str!("../../tests/fixtures/reducer_cases.json")).unwrap();
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
        let summary = Vec::from_iter(contributions.iter().map(|(bucket, values)| {
            let values = Vec::from_iter(values.iter().map(|(_, value)| *value));
            (bucket.reducer, bucket.start, values)
        }));

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
        let now = Utc::now();
        let first = vec![(now, 3.0), (now, 1.5)];
        let second = vec![(now, 2.0)];

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
