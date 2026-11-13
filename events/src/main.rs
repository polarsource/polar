use std::{
    net::{Ipv4Addr, SocketAddr},
    time::Duration,
};

use anyhow::Result;
use tokio::{
    net::TcpListener,
    signal::unix::{SignalKind, signal},
    sync::oneshot,
    time::Instant,
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

    let (signalled, signalled_at) = oneshot::channel();
    let server = axum::serve(
        listener,
        app::router(state.clone()).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(async move {
        shutdown_signal().await;
        let _ = signalled.send(Instant::now());
    });
    let drain = async {
        server.await?;
        state.tasks.close();
        state.tasks.wait().await;
        anyhow::Ok(())
    };
    tokio::pin!(drain);
    tokio::select! {
        drained = &mut drain => drained?,
        Ok(signalled_at) = signalled_at => {
            match tokio::time::timeout_at(signalled_at + SHUTDOWN_GRACE, &mut drain).await {
                Ok(drained) => drained?,
                Err(_) => tracing::error!(
                    "in-flight requests, writes and job sends did not finish before shutdown"
                ),
            }
        }
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
