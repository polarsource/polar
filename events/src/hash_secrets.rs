use std::{collections::HashMap, time::Duration};

use anyhow::{Context, anyhow, bail};
use aws_config::{SdkConfig, retry::RetryConfig, timeout::TimeoutConfig};
use aws_sdk_secretsmanager::{Client, config::Builder};

const LEGACY_STAGE: &str = "LEGACY";
const CURRENT_STAGE: &str = "AWSCURRENT";
const AWS_MANAGED_STAGES: [&str; 3] = [CURRENT_STAGE, "AWSPREVIOUS", "AWSPENDING"];
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const READ_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_ATTEMPTS: u32 = 4;

pub struct HashSecrets {
    pub secrets: HashMap<String, String>,
    pub legacy: String,
}

#[derive(Debug, PartialEq)]
struct VersionRole<'a> {
    secret_id: Option<&'a str>,
    is_current: bool,
    is_legacy: bool,
}

fn version_role<'a>(
    version_id: &str,
    stages: &'a [String],
) -> anyhow::Result<Option<VersionRole<'a>>> {
    let is_legacy = stages.iter().any(|stage| stage == LEGACY_STAGE);
    let mut labels = stages
        .iter()
        .map(String::as_str)
        .filter(|stage| *stage != LEGACY_STAGE && !AWS_MANAGED_STAGES.contains(stage));
    let secret_id = labels.next();
    let extra = labels.count();
    if extra > 0 {
        bail!(
            "version {version_id} carries {} custom staging labels, expected at most one",
            extra + 1
        );
    }
    if secret_id.is_none() && !is_legacy {
        return Ok(None);
    }
    Ok(Some(VersionRole {
        secret_id,
        is_current: stages.iter().any(|stage| stage == CURRENT_STAGE),
        is_legacy,
    }))
}

pub async fn fetch(
    sdk_config: &SdkConfig,
    arn: &str,
    fallback_legacy: String,
    endpoint_url: Option<&str>,
) -> anyhow::Result<HashSecrets> {
    let mut builder = Builder::from(sdk_config)
        .timeout_config(
            TimeoutConfig::builder()
                .connect_timeout(CONNECT_TIMEOUT)
                .read_timeout(READ_TIMEOUT)
                .build(),
        )
        .retry_config(RetryConfig::standard().with_max_attempts(MAX_ATTEMPTS));
    if let Some(endpoint_url) = endpoint_url {
        builder = builder.endpoint_url(endpoint_url);
    }
    let client = Client::from_conf(builder.build());

    let mut secrets = HashMap::new();
    let mut has_current = false;
    let mut legacy = None;
    let mut next_token = None;
    loop {
        let page = client
            .list_secret_version_ids()
            .secret_id(arn)
            .include_deprecated(false)
            .set_next_token(next_token)
            .send()
            .await
            .context("listing the hash secret versions")?;
        for version in page.versions() {
            let version_id = version
                .version_id()
                .ok_or_else(|| anyhow!("a hash secret version has no id"))?;
            let Some(role) = version_role(version_id, version.version_stages())? else {
                continue;
            };
            let secret = client
                .get_secret_value()
                .secret_id(arn)
                .version_id(version_id)
                .send()
                .await
                .with_context(|| format!("reading hash secret version {version_id}"))?
                .secret_string
                .ok_or_else(|| anyhow!("hash secret version {version_id} has no string value"))?;
            if role.is_legacy && !secret.is_empty() {
                legacy = Some(secret.clone());
            }
            if let Some(secret_id) = role.secret_id {
                has_current |= role.is_current;
                secrets.insert(secret_id.to_owned(), secret);
            }
        }
        next_token = page.next_token;
        if next_token.is_none() {
            break;
        }
    }

    if !has_current {
        bail!("the hash secret has no current version");
    }
    if legacy.is_none() {
        tracing::warn!("the hash secret has no legacy version");
    }
    Ok(HashSecrets {
        secrets,
        legacy: legacy.unwrap_or(fallback_legacy),
    })
}

#[cfg(test)]
mod tests {
    use std::{
        net::Ipv4Addr,
        sync::{Arc, Mutex},
    };

    use axum::{Json, Router, extract::State, http::HeaderMap};
    use serde_json::{Value, json};
    use tokio::net::TcpListener;

    use super::*;
    use crate::aws::{AwsSettings, sdk_config};

    type ReadVersions = Arc<Mutex<Vec<String>>>;

    fn stages(stages: &[&str]) -> Vec<String> {
        Vec::from_iter(stages.iter().map(|stage| (*stage).to_owned()))
    }

    #[test]
    fn classifies_versions_by_their_staging_labels() {
        let current = stages(&["AWSCURRENT", "k2"]);
        let retired = stages(&["k1", "LEGACY"]);
        let unlabelled = stages(&["AWSPREVIOUS"]);
        let ambiguous = stages(&["k1", "k2"]);

        assert_eq!(
            version_role("v", &current).unwrap(),
            Some(VersionRole {
                secret_id: Some("k2"),
                is_current: true,
                is_legacy: false,
            })
        );
        assert_eq!(
            version_role("v", &retired).unwrap(),
            Some(VersionRole {
                secret_id: Some("k1"),
                is_current: false,
                is_legacy: true,
            })
        );
        assert_eq!(version_role("v", &unlabelled).unwrap(), None);
        assert!(version_role("v", &ambiguous).is_err());
    }

    async fn mock_secrets_manager(
        State(read): State<ReadVersions>,
        headers: HeaderMap,
        body: String,
    ) -> Json<Value> {
        let body: Value = serde_json::from_str(&body).unwrap();
        if let Some(version_id) = body["VersionId"].as_str() {
            read.lock().unwrap().push(version_id.to_owned());
        }
        let target = headers["x-amz-target"].to_str().unwrap();
        Json(
            match (
                target,
                body["NextToken"].as_str(),
                body["VersionId"].as_str(),
            ) {
                ("secretsmanager.ListSecretVersionIds", ..)
                    if body["SecretId"] != "arn" || body["IncludeDeprecated"] != false =>
                {
                    json!({
                        "Versions": [{ "VersionId": "v0", "VersionStages": ["k0", "LEGACY"] }],
                    })
                }
                ("secretsmanager.ListSecretVersionIds", None, _) => json!({
                    "Versions": [
                        { "VersionId": "v3", "VersionStages": ["AWSCURRENT", "k2"] },
                        { "VersionId": "v2", "VersionStages": ["AWSPREVIOUS"] },
                    ],
                    "NextToken": "next",
                }),
                ("secretsmanager.ListSecretVersionIds", Some(_), _) => json!({
                    "Versions": [{ "VersionId": "v1", "VersionStages": ["k1", "LEGACY"] }],
                }),
                (_, _, Some(version_id)) => {
                    json!({ "SecretString": format!("secret-{version_id}") })
                }
                _ => json!({}),
            },
        )
    }

    #[tokio::test]
    async fn fetches_every_labelled_version_across_pages() {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.unwrap();
        let endpoint_url = format!("http://{}", listener.local_addr().unwrap());
        let read = ReadVersions::default();
        let mock = Router::new()
            .fallback(mock_secrets_manager)
            .with_state(read.clone());
        tokio::spawn(async move { axum::serve(listener, mock).await });
        let sdk_config = sdk_config(&AwsSettings {
            region: "us-east-2".to_owned(),
            static_credentials: Some(("key".to_owned(), "secret".to_owned())),
        })
        .await;

        let hash_secrets = fetch(
            &sdk_config,
            "arn",
            "fallback".to_owned(),
            Some(&endpoint_url),
        )
        .await
        .unwrap();
        let without_current = fetch(
            &sdk_config,
            "other-arn",
            "fallback".to_owned(),
            Some(&endpoint_url),
        )
        .await;

        assert_eq!(
            hash_secrets.secrets,
            HashMap::from([
                ("k2".to_owned(), "secret-v3".to_owned()),
                ("k1".to_owned(), "secret-v1".to_owned()),
            ])
        );
        assert_eq!(hash_secrets.legacy, "secret-v1");
        assert_eq!(*read.lock().unwrap(), ["v3", "v1", "v0"]);
        assert!(
            without_current.is_err_and(|error| error.to_string().contains("no current version"))
        );
    }
}
