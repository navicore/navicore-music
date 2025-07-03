# Navicore Music

A personal music streaming service built with Rust, WebAssembly, and Cloudflare R2.

## Architecture

- **Frontend**: Rust/WebAssembly with Yew framework
- **Backend**: Rust with Axum web framework
- **Storage**: Cloudflare R2 for audio files
- **Database**: SQLite for metadata

## Project Structure

```
navicore-music/
├── backend/        # API server
├── frontend/       # WebAssembly web app
├── shared/         # Common types and models
└── ARCHITECTURE.md # Detailed architecture documentation
```

## Setup

### Prerequisites

- Rust 1.70+
- wasm-pack for building WebAssembly
- Cloudflare R2 bucket configured

### Environment Variables

Create a `.env` file in the backend directory:

```env
DATABASE_URL=sqlite://navicore_music.db
PORT=3000
R2_BUCKET_NAME=your-bucket-name
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
JWT_SECRET=your-jwt-secret
```

### Development

1. Install dependencies:
```bash
cargo build
```

2. Run database migrations:
```bash
cd backend
sqlx migrate run
```

3. Start the backend:
```bash
cargo run -p backend
```

4. Build and serve the frontend:
```bash
cd frontend
wasm-pack build --target web
python3 -m http.server 8080 --directory dist
```

## Features

### Current
- Stream music from Cloudflare R2
- Web-based audio player
- Track metadata management
- Secure presigned URLs

### Planned
- Playlist management
- Search functionality
- Admin upload interface
- Mobile app wrapper

## API Endpoints

See `ARCHITECTURE.md` for detailed API documentation.

## License

MIT