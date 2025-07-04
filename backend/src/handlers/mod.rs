pub mod tracks;
pub mod playlists;
pub mod auth;
pub mod stream;

use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;

pub struct ApiError(anyhow::Error);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let error_message = self.0.to_string();
        let status_code = StatusCode::INTERNAL_SERVER_ERROR;

        let body = Json(json!({
            "error": error_message,
        }));

        (status_code, body).into_response()
    }
}

impl<E> From<E> for ApiError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}