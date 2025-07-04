use axum::{Json};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};

use super::ApiError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub expires_in: i64,
}

pub async fn login(
    Json(_payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, ApiError> {
    // TODO: Implement actual authentication
    // For now, return a dummy token for development
    
    let now = Utc::now();
    let expires_in = Duration::try_hours(24).unwrap();
    let exp = (now + expires_in).timestamp();
    
    let claims = Claims {
        sub: "dev-user".to_string(),
        exp,
        iat: now.timestamp(),
    };
    
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret("dev-jwt-secret".as_ref()),
    )?;
    
    Ok(Json(LoginResponse {
        token,
        expires_in: expires_in.num_seconds(),
    }))
}