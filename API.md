# Navicore Music API

## Base URL
- Production: `https://api.navicore.tech`
- Development: `http://localhost:3000`

## Endpoints

### Health Check
```
GET /health
```

### Tracks

#### List all tracks
```
GET /api/v1/tracks
GET /api/v1/tracks?q=search_term
```

#### Get track details
```
GET /api/v1/tracks/:id
```

#### Create track
```
POST /api/v1/tracks
{
  "title": "Song Title",
  "artist": "Artist Name",
  "album": "Album Name",
  "duration": 240,
  "file_path": "songs/artist/album/song.mp3",
  "genre": "Rock",
  "year": 2024,
  "track_number": 1
}
```

#### Delete track
```
DELETE /api/v1/tracks/:id
```

#### Get streaming URL
```
GET /api/v1/tracks/:id/stream
```
Returns a presigned URL valid for 1 hour

#### Record play
```
POST /api/v1/tracks/:id/play
{
  "duration": 180  // seconds listened
}
```

### Playlists

#### List all playlists
```
GET /api/v1/playlists
```

#### Get playlist details
```
GET /api/v1/playlists/:id
```

#### Create playlist
```
POST /api/v1/playlists
{
  "name": "My Playlist",
  "description": "Optional description"
}
```

#### Add track to playlist
```
POST /api/v1/playlists/:id/tracks
{
  "track_id": "track-uuid",
  "position": 0  // optional, defaults to end
}
```

#### Remove track from playlist
```
DELETE /api/v1/playlists/:id/tracks/:track_id
```

### Authentication

#### Login (Development only)
```
POST /api/v1/auth/login
{
  "username": "any",
  "password": "any"
}
```
Returns JWT token valid for 24 hours