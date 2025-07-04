// Cloudflare Worker for Navicore Music API
// This implements the API endpoints using D1 and R2

import { parseZipFile, extractMetadataFromFiles, parseTrackInfoFromFilename } from './zip-utils.mjs';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Handle preflight requests
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Check Content-Length for large uploads before processing
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 128 * 1024 * 1024) {
      return new Response(JSON.stringify({ 
        error: 'Request too large', 
        details: `File size is ${Math.round(parseInt(contentLength) / 1024 / 1024)}MB. Maximum size is 128MB due to Cloudflare Workers limits.`,
        tip: 'For large albums, consider uploading tracks individually or using a smaller ZIP file.'
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    try {
      // Route requests
      if (path === '/') {
        return handleRoot();
      } else if (path === '/health') {
        return await handleHealth(env);
      } else if (path === '/api/v1/tracks' && method === 'GET') {
        return await handleListTracks(request, env);
      } else if (path === '/api/v1/tracks' && method === 'POST') {
        return await handleCreateTrack(request, env);
      } else if (path.match(/^\/api\/v1\/tracks\/[^\/]+$/) && method === 'GET') {
        const id = path.split('/').pop();
        return await handleGetTrack(id, env);
      } else if (path.match(/^\/api\/v1\/tracks\/[^\/]+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        return await handleDeleteTrack(id, env);
      } else if (path.match(/^\/api\/v1\/tracks\/[^\/]+\/stream$/) && method === 'GET') {
        const id = path.split('/')[4];
        return await handleGetStreamUrl(id, env);
      } else if (path === '/api/v1/upload/file' && method === 'POST') {
        return await handleFileUpload(request, env);
      } else if (path === '/api/v1/upload/album' && method === 'POST') {
        return await handleAlbumUpload(request, env);
      } else {
        return new Response('Not Found', { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

function handleRoot() {
  return new Response('Navicore Music API - Ready for Development!', {
    headers: { 'Content-Type': 'text/plain' },
  });
}

async function handleHealth(env) {
  const dbConnected = env.DB ? true : false;
  const r2Connected = env.MUSIC_BUCKET ? true : false;
  
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'navicore-music-api',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'production',
    bindings: {
      db: dbConnected ? 'connected' : 'not connected',
      r2: r2Connected ? 'connected' : 'not connected',
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleListTracks(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  const url = new URL(request.url);
  const searchQuery = url.searchParams.get('q');
  const limit = url.searchParams.get('limit');
  
  let query;
  let params = [];
  
  if (searchQuery) {
    const searchTerm = `%${searchQuery}%`;
    query = `
      SELECT * FROM tracks 
      WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
      ORDER BY artist, album, track_number
    `;
    params = [searchTerm, searchTerm, searchTerm];
  } else {
    query = 'SELECT * FROM tracks ORDER BY created_at DESC';
  }
  
  if (limit) {
    query += ` LIMIT ${parseInt(limit)}`;
  }
  
  const result = await env.DB.prepare(query).bind(...params).all();
  
  return new Response(JSON.stringify({
    tracks: result.results || [],
    count: result.results ? result.results.length : 0,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleCreateTrack(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  const track = await request.json();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  await env.DB.prepare(`
    INSERT INTO tracks (id, title, artist, album, duration, file_path, 
                       cover_art_path, genre, year, track_number, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    track.title,
    track.artist,
    track.album,
    track.duration,
    track.file_path,
    track.cover_art_path || null,
    track.genre || null,
    track.year || null,
    track.track_number || null,
    now,
    now
  ).run();
  
  const newTrack = {
    id,
    ...track,
    created_at: now,
    updated_at: now,
  };
  
  return new Response(JSON.stringify(newTrack), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetTrack(id, env) {
  const result = await env.DB.prepare('SELECT * FROM tracks WHERE id = ?')
    .bind(id)
    .first();
  
  if (!result) {
    return new Response('Track not found', { status: 404 });
  }
  
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleDeleteTrack(id, env) {
  const result = await env.DB.prepare('DELETE FROM tracks WHERE id = ?')
    .bind(id)
    .run();
  
  if (result.meta.changes === 0) {
    return new Response('Track not found', { status: 404 });
  }
  
  return new Response(JSON.stringify({ message: 'Track deleted successfully' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGetStreamUrl(trackId, env) {
  // Get track file path
  const track = await env.DB.prepare('SELECT file_path FROM tracks WHERE id = ?')
    .bind(trackId)
    .first();
  
  if (!track) {
    return new Response('Track not found', { status: 404 });
  }
  
  // Generate presigned URL for R2
  // For now, return a placeholder URL
  // In production, you would use R2's presigned URL functionality
  const expiresIn = 3600; // 1 hour
  const url = `https://r2.navicore.tech/${track.file_path}?expires=${Date.now() + expiresIn * 1000}`;
  
  return new Response(JSON.stringify({
    url,
    expires_in: expiresIn,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleFileUpload(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Check content length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) {
      return new Response(JSON.stringify({ 
        error: 'File too large', 
        details: 'Maximum file size is 100MB' 
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const metadata = formData.get('metadata');
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Log file info for debugging
    console.log('File upload:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    // Parse metadata if provided
    let trackMetadata = {};
    if (metadata) {
      try {
        trackMetadata = JSON.parse(metadata);
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid metadata JSON' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Generate unique file path
    const fileExt = file.name.split('.').pop().toLowerCase();
    const trackId = crypto.randomUUID();
    const filePath = `tracks/${trackId}.${fileExt}`;
    
    // Upload to R2
    await env.MUSIC_BUCKET.put(filePath, file.stream(), {
      httpMetadata: {
        contentType: file.type || 'audio/mpeg',
      },
    });
    
    // Extract basic metadata from filename if not provided
    if (!trackMetadata.title) {
      // Remove extension and clean up filename
      trackMetadata.title = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/^\d+[\s\-_]*/, '') // Remove track numbers
        .replace(/[\-_]/g, ' ')
        .trim();
    }
    
    // Create track record
    const now = new Date().toISOString();
    const track = {
      id: trackId,
      title: trackMetadata.title || 'Untitled',
      artist: trackMetadata.artist || 'Unknown Artist',
      album: trackMetadata.album || 'Unknown Album',
      duration: trackMetadata.duration || 0, // TODO: Extract from file
      file_path: filePath,
      cover_art_path: null,
      genre: trackMetadata.genre || null,
      year: trackMetadata.year || new Date().getFullYear(),
      track_number: trackMetadata.track_number || null,
      created_at: now,
      updated_at: now,
    };
    
    // Save to database
    await env.DB.prepare(`
      INSERT INTO tracks (id, title, artist, album, duration, file_path, 
                         cover_art_path, genre, year, track_number, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      track.id,
      track.title,
      track.artist,
      track.album,
      track.duration,
      track.file_path,
      track.cover_art_path,
      track.genre,
      track.year,
      track.track_number,
      track.created_at,
      track.updated_at
    ).run();
    
    return new Response(JSON.stringify({
      success: true,
      track: track,
      message: 'File uploaded successfully',
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ 
      error: 'Upload failed', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleAlbumUpload(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const formData = await request.formData();
    const zipFile = formData.get('album');
    
    if (!zipFile) {
      return new Response(JSON.stringify({ error: 'No album ZIP provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Album upload:', {
      name: zipFile.name,
      size: zipFile.size,
      type: zipFile.type
    });
    
    // Read ZIP file into ArrayBuffer
    const zipBuffer = await zipFile.arrayBuffer();
    
    // Parse ZIP file structure
    const zipFiles = await parseZipFile(zipBuffer);
    const metadata = extractMetadataFromFiles(zipFiles);
    
    console.log('ZIP contents:', {
      totalFiles: zipFiles.length,
      audioFiles: metadata.audioFiles.length,
      hasMetadata: metadata.hasMetadataFile,
      hasCover: metadata.hasCoverArt,
    });
    
    // Extract album info from ZIP filename
    const albumData = {
      title: zipFile.name.replace(/\.zip$/i, '').replace(/[\-_]/g, ' ').trim(),
      artist: 'Unknown Artist',
      year: new Date().getFullYear(),
      genre: null,
      cover: null,
    };
    
    const albumId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const uploadedTracks = [];
    
    // For now, upload the entire ZIP and create track records
    // In a full implementation, we'd extract individual files
    const zipPath = `albums/${albumId}/album.zip`;
    await env.MUSIC_BUCKET.put(zipPath, zipBuffer, {
      httpMetadata: {
        contentType: 'application/zip',
      },
    });
    
    // Create track records for each audio file found
    for (const audioFile of metadata.audioFiles) {
      const trackInfo = parseTrackInfoFromFilename(audioFile.name);
      const track = {
        id: crypto.randomUUID(),
        title: trackInfo.title,
        artist: albumData.artist,
        album: albumData.title,
        duration: 0, // Would need to extract from audio file
        file_path: `${zipPath}#${audioFile.name}`, // Reference within ZIP
        cover_art_path: metadata.coverFile ? `${zipPath}#${metadata.coverFile.name}` : null,
        genre: albumData.genre,
        year: albumData.year,
        track_number: trackInfo.trackNumber,
        created_at: timestamp,
        updated_at: timestamp,
      };
      
      // Save to database
      await env.DB.prepare(`
        INSERT INTO tracks (id, title, artist, album, duration, file_path, 
                           cover_art_path, genre, year, track_number, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        track.id,
        track.title,
        track.artist,
        track.album,
        track.duration,
        track.file_path,
        track.cover_art_path,
        track.genre,
        track.year,
        track.track_number,
        track.created_at,
        track.updated_at
      ).run();
      
      uploadedTracks.push(track);
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Album uploaded successfully',
      album: {
        id: albumId,
        ...albumData,
        tracks: uploadedTracks,
      },
      details: {
        totalFiles: zipFiles.length,
        audioFiles: metadata.audioFiles.length,
        hasMetadata: metadata.hasMetadataFile,
        hasCover: metadata.hasCoverArt,
      },
      note: uploadedTracks.length === 0 ? 'No audio files found in ZIP' : 
            'Files stored as ZIP archive - individual extraction coming soon',
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Album upload error:', error);
    return new Response(JSON.stringify({ 
      error: 'Album upload failed', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}