use std::env;

use anyhow::{Context, Result};
use sqlx::postgres::{PgConnectOptions, PgSslMode};

pub struct Config {
    pub port: u16,
    pub log_level: String,
    pub json_logs: bool,
    pub postgres: PgConnectOptions,
    pub postgres_pool_size: u32,
    pub redis_url: String,
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

        Ok(Self {
            port: var("PORT", "10000").parse().context("PORT")?,
            log_level: var("POLAR_LOG_LEVEL", "info"),
            json_logs: var("POLAR_ENV", "development") != "development",
            postgres,
            postgres_pool_size: var("POLAR_DATABASE_POOL_SIZE", "5")
                .parse()
                .context("POLAR_DATABASE_POOL_SIZE")?,
            redis_url,
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
        assert!(!config.json_logs);
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
            ("POLAR_POSTGRES_HOST", "db.internal"),
            ("POLAR_POSTGRES_SSL", "True"),
            ("POLAR_REDIS_HOST", "ignored"),
            ("POLAR_REDIS_URL", "rediss://cache.internal:6380/1"),
        ])
        .unwrap();

        assert_eq!(config.port, 8080);
        assert!(config.json_logs);
        assert_eq!(config.postgres.get_host(), "db.internal");
        assert!(matches!(config.postgres.get_ssl_mode(), PgSslMode::Require));
        assert_eq!(config.redis_url, "rediss://cache.internal:6380/1");
    }

    #[test]
    fn rejects_invalid_numbers() {
        assert!(config(&[("POLAR_POSTGRES_PORT", "not-a-port")]).is_err());
    }
}
