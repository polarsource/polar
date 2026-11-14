use std::time::{SystemTime, UNIX_EPOCH};

use redis::aio::ConnectionManager;
use serde_json::json;
use uuid::Uuid;

const CHANGES_RETENTION_MILLISECONDS: u128 = 60 * 60 * 1000;

#[derive(Debug)]
pub struct ReducerBucketChange {
    pub reducer_id: Uuid,
    pub customer_id: Option<Uuid>,
    pub external_customer_id: Option<String>,
}

pub async fn publish(
    redis: &mut ConnectionManager,
    organization_id: Uuid,
    changes: &[ReducerBucketChange],
) {
    if changes.is_empty() {
        return;
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let key = format!("outpost:changes:{organization_id}");
    let mut pipeline = redis::pipe();
    for change in changes {
        let event = json!({
            "type": "reducer_bucket",
            "reducer_id": change.reducer_id,
            "customer_id": change.customer_id,
            "external_customer_id": change.external_customer_id,
        });
        pipeline
            .cmd("XADD")
            .arg(&key)
            .arg("MINID")
            .arg("~")
            .arg((now.saturating_sub(CHANGES_RETENTION_MILLISECONDS)) as u64)
            .arg("*")
            .arg("event")
            .arg(event.to_string());
    }
    if let Err(error) = pipeline.query_async::<()>(redis).await {
        tracing::warn!(%error, count = changes.len(), "failed to publish outpost changes");
    }
}

#[cfg(test)]
mod tests {
    use redis::AsyncCommands;
    use serde_json::Value;

    use super::*;

    #[tokio::test]
    #[ignore = "needs the local development Redis"]
    async fn appends_changes_to_the_organization_stream() {
        let config = crate::config::Config::from_env().unwrap();
        let client = redis::Client::open(config.redis_url).unwrap();
        let mut redis = ConnectionManager::new(client).await.unwrap();
        let organization_id = Uuid::new_v4();
        let key = format!("outpost:changes:{organization_id}");
        let change = ReducerBucketChange {
            reducer_id: Uuid::from_u128(1),
            customer_id: None,
            external_customer_id: Some("customer".to_owned()),
        };

        publish(&mut redis, organization_id, &[change]).await;
        let entries: Vec<(String, Vec<(String, String)>)> = redis::cmd("XRANGE")
            .arg(&key)
            .arg("-")
            .arg("+")
            .query_async(&mut redis)
            .await
            .unwrap();
        let _: () = redis.del(&key).await.unwrap();

        let (field, event) = &entries[0].1[0];
        assert_eq!((entries.len(), field.as_str()), (1, "event"));
        assert_eq!(
            serde_json::from_str::<Value>(event).unwrap(),
            json!({
                "type": "reducer_bucket",
                "reducer_id": Uuid::from_u128(1),
                "customer_id": null,
                "external_customer_id": "customer",
            })
        );
    }
}
