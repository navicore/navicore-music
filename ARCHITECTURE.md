# Navicore Music - Personal Music Streaming Service

## Overview
A self-hosted music streaming service built entirely in Rust, featuring a WebAssembly frontend and Cloudflare R2 for storage.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser UI    │────▶│   Rust Backend   │────▶│  Cloudflare R2  │
│  (WebAssembly)  │◀────│   (API Server)   │◀────│ (Object Storage)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Core Components

### 1. Frontend (WebAssembly)
- **Framework**: Rust compiled to WASM using wasm-bindgen
- **Features**:
  - HTML5 audio player with custom controls
  - Responsive web design
  - Real-time playback management
  - Playlist management
  - Search and browse functionality

### 2. Backend API
- **Framework**: Axum or Actix-web
- **Responsibilities**:
  - Generate presigned URLs for audio streaming
  - Manage music metadata and playlists
  - Handle authentication and authorization
  - Track playback statistics
  - Admin endpoints for music management

### 3. Storage (Cloudflare R2)
- **Purpose**: Store audio files and cover art
- **Security**: Time-limited presigned URLs
- **Organization**: Hierarchical folder structure

## Data Models

### Track
```rust
struct Track {
    id: Uuid,
    title: String,
    artist: String,
    album: String,
    duration: u32,
    file_path: String,
    cover_art_path: Option<String>,
    genre: Option<String>,
    year: Option<u16>,
    track_number: Option<u16>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

### Playlist
```rust
struct Playlist {
    id: Uuid,
    name: String,
    description: Option<String>,
    tracks: Vec<Uuid>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

### User (for future multi-user support)
```rust
struct User {
    id: Uuid,
    username: String,
    email: String,
    password_hash: String,
    is_admin: bool,
    created_at: DateTime<Utc>,
}
```

## API Endpoints

### Public Endpoints
- `GET /api/tracks` - List all tracks with pagination
- `GET /api/tracks/{id}` - Get track metadata
- `GET /api/tracks/{id}/stream` - Get presigned URL for streaming
- `GET /api/albums` - List all albums
- `GET /api/artists` - List all artists
- `GET /api/playlists` - List playlists
- `GET /api/search?q={query}` - Search tracks

### Admin Endpoints
- `POST /api/admin/upload` - Upload new track
- `PUT /api/admin/tracks/{id}` - Update track metadata
- `DELETE /api/admin/tracks/{id}` - Delete track
- `POST /api/admin/scan` - Scan R2 bucket for new tracks

## Security Features
- Presigned URLs with expiration (default: 1 hour)
- Optional IP restriction on URLs
- Rate limiting per IP
- Admin authentication for management endpoints
- CORS configuration for web app

## Technology Stack
- **Language**: Rust
- **Backend Framework**: Axum
- **Frontend**: Yew or Leptos (WASM)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Database**: SQLite for metadata (embedded)
- **Authentication**: JWT tokens
- **Audio Processing**: Symphonia (for metadata extraction)

## Development Phases

### Phase 1: MVP
- Basic API with track listing and streaming
- Simple web player with play/pause
- R2 integration with presigned URLs
- SQLite metadata storage

### Phase 2: Enhanced Features
- Full audio player controls (seek, volume, next/prev)
- Playlist management
- Search functionality
- Album and artist views

### Phase 3: Advanced Features
- Admin dashboard for uploads
- Automatic metadata extraction
- Mobile app wrapper
- Offline caching
- Multi-user support