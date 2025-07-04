use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{
    db::queries,
    AppState,
};

use super::ApiError;

#[derive(Debug, Serialize)]
pub struct StreamUrlResponse {
    url: String,
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
pub struct RecordPlayRequest {
    duration: Option<i32>,
}

const PRESIGNED_URL_EXPIRY_SECONDS: u64 = 3600; // 1 hour

pub async fn get_stream_url(
    State(state): State<Arc<AppState>>,
    Path(track_id): Path<String>,
) -> Result<Json<StreamUrlResponse>, ApiError> {
    let track = queries::get_track_by_id(&state.db, &track_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Track not found"))?;

    let url = state
        .storage
        .generate_presigned_url(&track.file_path, PRESIGNED_URL_EXPIRY_SECONDS)
        .await?;

    Ok(Json(StreamUrlResponse {
        url,
        expires_in: PRESIGNED_URL_EXPIRY_SECONDS,
    }))
}

pub async fn record_play(
    State(state): State<Arc<AppState>>,
    Path(track_id): Path<String>,
    Json(payload): Json<RecordPlayRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // TODO: Get user_id from auth context when implemented
    let user_id = None;

    queries::record_play(&state.db, &track_id, user_id, payload.duration).await?;

    Ok(Json(serde_json::json!({
        "message": "Play recorded"
    })))
}