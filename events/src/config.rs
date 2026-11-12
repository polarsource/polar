use std::{collections::HashMap, env};

use anyhow::{Context, Result};
use sqlx::postgres::{PgConnectOptions, PgSslMode};
use tracing::level_filters::LevelFilter;

use crate::auth::AuthSettings;

pub struct Config {
    pub port: u16,
    pub environment: String,
    pub service_name: String,
    pub release_version: Option<String>,
    pub log_level: LevelFilter,
    pub logfire_token: Option<String>,
    pub postgres: PgConnectOptions,
    pub postgres_pool_size: u32,
    pub redis_url: String,
    pub auth: AuthSettings,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Self::from_lookup(|key| env::var(key).ok())
    }

    fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Result<Self> {
        let var = |key: &str, default: &str| lookup(key).unwrap_or_else(|| default.to_owned());

        let postgres_ssl = matches!(
            var("POLAR_POSTGRES_SSL", "false").to_lowercase().as_str(),
            "true" | "1" | "yes" | "on"
        );
        let postgres = PgConnectOptions::new()
            .host(&var("POLAR_POSTGRES_HOST", "127.0.0.1"))
            .port(
                var("POLAR_POSTGRES_PORT", "5432")
                    .parse()
                    .context("POLAR_POSTGRES_PORT")?,
            )
            .username(&var("POLAR_POSTGRES_USER", "polar"))
            .password(&var("POLAR_POSTGRES_PWD", "polar"))
            .database(&var("POLAR_POSTGRES_DATABASE", "polar"))
            .application_name("events")
            .ssl_mode(if postgres_ssl {
                PgSslMode::Require
            } else {
                PgSslMode::Prefer
            });

        let redis_url = lookup("POLAR_REDIS_URL").unwrap_or_else(|| {
            format!(
                "redis://{}:{}/{}",
                var("POLAR_REDIS_HOST", "127.0.0.1"),
                var("POLAR_REDIS_PORT", "6379"),
                var("POLAR_REDIS_DB", "0"),
            )
        });

        let hash_secrets: HashMap<String, String> =
            serde_json::from_str(&var("POLAR_HASH_SECRETS", "{}")).context("POLAR_HASH_SECRETS")?;
        let auth = AuthSettings::new(
            hash_secrets,
            var("POLAR_SECRET", "super secret jwt secret"),
            &var("POLAR_BASE_URL", "http://127.0.0.1:8000"),
        );

        Ok(Self {
            port: var("PORT", "10000").parse().context("PORT")?,
            environment: var("POLAR_ENV", "development"),
            service_name: var("RENDER_SERVICE_NAME", "events"),
            release_version: lookup("RELEASE_VERSION"),
            log_level: var("POLAR_LOG_LEVEL", "info")
                .parse()
                .unwrap_or(LevelFilter::INFO),
            logfire_token: lookup("POLAR_LOGFIRE_TOKEN"),
            postgres,
            postgres_pool_size: var("POLAR_DATABASE_POOL_SIZE", "5")
                .parse()
                .context("POLAR_DATABASE_POOL_SIZE")?,
            redis_url,
            auth,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(vars: &[(&str, &str)]) -> Result<Config> {
        Config::from_lookup(|key| {
            vars.iter()
                .find(|(name, _)| *name == key)
                .map(|(_, value)| (*value).to_owned())
        })
    }

    #[test]
    fn defaults_match_local_dev_stack() {
        let config = config(&[]).unwrap();

        assert_eq!(config.port, 10000);
        assert_eq!(config.environment, "development");
        assert_eq!(config.service_name, "events");
        assert_eq!(config.log_level, LevelFilter::INFO);
        assert!(config.logfire_token.is_none());
        assert_eq!(config.postgres.get_host(), "127.0.0.1");
        assert_eq!(config.postgres.get_port(), 5432);
        assert_eq!(config.postgres.get_database(), Some("polar"));
        assert_eq!(config.redis_url, "redis://127.0.0.1:6379/0");
    }

    #[test]
    fn reads_overrides() {
        let config = config(&[
            ("PORT", "8080"),
            ("POLAR_ENV", "production"),
            ("POLAR_LOG_LEVEL", "DEBUG"),
            ("POLAR_LOGFIRE_TOKEN", "token"),
            ("POLAR_POSTGRES_HOST", "db.internal"),
            ("POLAR_POSTGRES_SSL", "True"),
            ("POLAR_REDIS_HOST", "ignored"),
            ("POLAR_REDIS_URL", "rediss://cache.internal:6380/1"),
        ])
        .unwrap();

        assert_eq!(config.port, 8080);
        assert_eq!(config.environment, "production");
        assert_eq!(config.log_level, LevelFilter::DEBUG);
        assert_eq!(config.logfire_token.as_deref(), Some("token"));
        assert_eq!(config.postgres.get_host(), "db.internal");
        assert!(matches!(config.postgres.get_ssl_mode(), PgSslMode::Require));
        assert_eq!(config.redis_url, "rediss://cache.internal:6380/1");
    }

    #[test]
    fn rejects_invalid_values() {
        assert!(config(&[("POLAR_POSTGRES_PORT", "not-a-port")]).is_err());
        assert!(config(&[("POLAR_HASH_SECRETS", "not-json")]).is_err());
    }
}
