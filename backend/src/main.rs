use anyhow::Result;
use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod db;
mod handlers;
mod storage;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "navicore_music=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::Config::from_env()?;
    let db_pool = db::create_pool(&config.database_url).await?;
    db::run_migrations(&db_pool).await?;
    
    let storage = storage::S3Storage::new(&config).await?;
    
    let app_state = handlers::AppState {
        db: db_pool,
        storage,
        config: config.clone(),
    };

    let app = Router::new()
        .route("/api/tracks", get(handlers::list_tracks))
        .route("/api/tracks/:id", get(handlers::get_track))
        .route("/api/tracks/:id/stream", get(handlers::get_stream_url))
        .route("/api/albums", get(handlers::list_albums))
        .route("/api/artists", get(handlers::list_artists))
        .route("/api/playlists", get(handlers::list_playlists))
        .route("/api/search", get(handlers::search))
        .route("/api/admin/upload", post(handlers::upload_track))
        .route("/api/admin/scan", post(handlers::scan_bucket))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("Server running on http://{}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}