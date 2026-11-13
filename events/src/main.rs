use std::{net::Ipv4Addr, time::Duration};

use anyhow::Result;
use tokio::{
    net::TcpListener,
    signal::unix::{SignalKind, signal},
};

use events::{
    app::{self, AppState},
    config::Config,
    telemetry,
};

const SHUTDOWN_GRACE: Duration = Duration::from_secs(25);

#[tokio::main]
async fn main() -> Result<()> {
    let config = Config::from_env()?;
    let _telemetry = telemetry::init(&config)?;

    let port = config.port;
    let state = AppState::connect(config).await?;

    let listener = TcpListener::bind((Ipv4Addr::UNSPECIFIED, port)).await?;
    tracing::info!(port, "listening");

    axum::serve(listener, app::router(state.clone()))
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    state.tasks.close();
    if tokio::time::timeout(SHUTDOWN_GRACE, state.tasks.wait())
        .await
        .is_err()
    {
        tracing::error!("in-flight writes and job sends did not finish before shutdown");
    }
    state.db.close().await;
    Ok(())
}

async fn shutdown_signal() {
    let mut sigterm = signal(SignalKind::terminate()).expect("SIGTERM handler");
    tokio::select! {
        _ = sigterm.recv() => {}
        _ = tokio::signal::ctrl_c() => {}
    }
    tracing::info!("shutting down");
}
