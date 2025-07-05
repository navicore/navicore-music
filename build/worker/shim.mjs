// Cloudflare Worker for Navicore Music API
// This implements the API endpoints using D1 and R2

import { parseZipFile, extractMetadataFromFiles, parseTrackInfoFromFilename } from './zip-utils.mjs';
import { setAlbumTags, setTrackTags, searchByTag, getPopularTags } from './tag-operations.mjs';

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
        return await handleGetStreamUrl(id, env, request);
      } else if (path === '/api/v1/upload/file' && method === 'POST') {
        return await handleFileUpload(request, env);
      } else if (path === '/api/v1/upload/album' && method === 'POST') {
        return await handleAlbumUpload(request, env);
      } else if (path === '/api/v1/upload/cover' && method === 'POST') {
        return await handleCoverUpload(request, env);
      } else if (path.match(/^\/api\/v1\/tracks\/[^\/]+\/cover$/) && method === 'GET') {
        const id = path.split('/')[4];
        return await handleGetCover(id, env, request);
      } else if (path === '/api/v1/tags' && method === 'GET') {
        return await handleGetTags(request, env);
      } else if (path.match(/^\/album\/.+$/) && method === 'GET') {
        return await handleAlbumPage(request, env);
      } else if (path.match(/^\/track\/.+$/) && method === 'GET') {
        return await handleTrackPage(request, env);
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
    
    // Check if it's a tag search (prefixed with #)
    if (searchQuery.startsWith('#')) {
      const tagName = searchQuery.substring(1);
      const tagResults = await searchByTag(env, tagName, 'track');
      return new Response(JSON.stringify({
        tracks: tagResults.tracks || [],
        count: tagResults.tracks ? tagResults.tracks.length : 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Regular search in title, artist, album
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
                       cover_art_path, tags, year, track_number, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    track.title,
    track.artist,
    track.album,
    track.duration,
    track.file_path,
    track.cover_art_path || null,
    track.tags || null,
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
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // First get the track to find the file path
  const track = await env.DB.prepare('SELECT file_path FROM tracks WHERE id = ?')
    .bind(id)
    .first();
  
  if (!track) {
    return new Response('Track not found', { 
      status: 404,
      headers: corsHeaders 
    });
  }
  
  // Delete from database
  const result = await env.DB.prepare('DELETE FROM tracks WHERE id = ?')
    .bind(id)
    .run();
  
  // Also delete the file from R2
  if (track.file_path) {
    try {
      await env.MUSIC_BUCKET.delete(track.file_path);
    } catch (error) {
      console.error('Failed to delete file from R2:', error);
      // Continue anyway - the database record is already deleted
    }
  }
  
  return new Response(JSON.stringify({ message: 'Track deleted successfully' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getAudioContentType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const mimeTypes = {
    'mp3': 'audio/mpeg',
    'flac': 'audio/flac',
    'ogg': 'audio/ogg',
    'oga': 'audio/ogg',
    'wav': 'audio/wav',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'opus': 'audio/opus',
    'webm': 'audio/webm'
  };
  return mimeTypes[ext] || 'audio/mpeg';
}

async function handleGetStreamUrl(trackId, env, request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
  };

  // Get track file path
  const track = await env.DB.prepare('SELECT file_path, title FROM tracks WHERE id = ?')
    .bind(trackId)
    .first();
  
  if (!track) {
    return new Response('Track not found', { 
      status: 404,
      headers: corsHeaders 
    });
  }
  
  try {
    // Get the audio file from R2
    const object = await env.MUSIC_BUCKET.get(track.file_path);
    
    if (!object) {
      return new Response('Audio file not found', { 
        status: 404,
        headers: corsHeaders 
      });
    }
    
    // Handle range requests for audio streaming
    const range = request.headers.get('Range');
    if (range) {
      const bytes = range.replace(/bytes=/, '').split('-');
      const start = parseInt(bytes[0], 10);
      const end = bytes[1] ? parseInt(bytes[1], 10) : object.size - 1;
      const contentLength = end - start + 1;
      
      const slicedObject = await env.MUSIC_BUCKET.get(track.file_path, {
        range: { offset: start, length: contentLength }
      });
      
      return new Response(slicedObject.body, {
        status: 206,
        headers: {
          ...corsHeaders,
          'Content-Type': getAudioContentType(track.file_path),
          'Content-Length': contentLength.toString(),
          'Content-Range': `bytes ${start}-${end}/${object.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
    // Return full file
    return new Response(object.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': object.size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Stream error:', error);
    return new Response('Error streaming audio', { 
      status: 500,
      headers: corsHeaders 
    });
  }
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
      cover_art_path: trackMetadata.cover_art_path || null,
      year: trackMetadata.year || new Date().getFullYear(),
      track_number: trackMetadata.track_number || null,
      created_at: now,
      updated_at: now,
    };
    
    // Save to database (without tags column)
    await env.DB.prepare(`
      INSERT INTO tracks (id, title, artist, album, duration, file_path, 
                         cover_art_path, year, track_number, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      track.id,
      track.title,
      track.artist,
      track.album,
      track.duration,
      track.file_path,
      track.cover_art_path,
      track.year,
      track.track_number,
      track.created_at,
      track.updated_at
    ).run();
    
    // Handle tags separately using normalized tag system
    if (trackMetadata.tags) {
      await setTrackTags(env, track.id, trackMetadata.tags);
    }
    
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
      tags: null,
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
        tags: albumData.tags,
        year: albumData.year,
        track_number: trackInfo.trackNumber,
        created_at: timestamp,
        updated_at: timestamp,
      };
      
      // Save to database
      await env.DB.prepare(`
        INSERT INTO tracks (id, title, artist, album, duration, file_path, 
                           cover_art_path, tags, year, track_number, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        track.id,
        track.title,
        track.artist,
        track.album,
        track.duration,
        track.file_path,
        track.cover_art_path,
        track.tags,
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

async function handleCoverUpload(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response(JSON.stringify({ 
        error: 'No file provided' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Generate unique filename
    const ext = file.name.split('.').pop();
    const coverId = crypto.randomUUID();
    const coverPath = `covers/${coverId}.${ext}`;
    
    // Upload to R2
    await env.MUSIC_BUCKET.put(coverPath, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });
    
    return new Response(JSON.stringify({
      success: true,
      path: coverPath,
      message: 'Cover art uploaded successfully',
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Cover upload error:', error);
    return new Response(JSON.stringify({ 
      error: 'Cover upload failed', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleGetCover(trackId, env, request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
  };
  
  try {
    // Get track to find cover art path
    const track = await env.DB.prepare(
      'SELECT cover_art_path FROM tracks WHERE id = ?'
    ).bind(trackId).first();
    
    if (!track || !track.cover_art_path) {
      // Return 404 if no cover art
      return new Response('Cover art not found', { 
        status: 404, 
        headers: corsHeaders 
      });
    }
    
    // Get the cover from R2
    const object = await env.MUSIC_BUCKET.get(track.cover_art_path);
    
    if (!object) {
      return new Response('Cover art file not found', { 
        status: 404, 
        headers: corsHeaders 
      });
    }
    
    // Return the image with proper headers
    const headers = new Headers(object.httpMetadata || {});
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Get cover error:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

async function handleAlbumPage(request, env) {
  const url = new URL(request.url);
  const albumKey = decodeURIComponent(url.pathname.substring(7));
  const [artist, album] = albumKey.split("::");
  
  // For now, redirect to the main app with the album hash
  // In a full implementation, this would render server-side HTML with Open Graph tags
  return Response.redirect(`https://navicore.tech/#album/${encodeURIComponent(albumKey)}`, 302);
}

async function handleTrackPage(request, env) {
  const url = new URL(request.url);
  const trackId = url.pathname.substring(7);
  
  // For now, redirect to the main app with the track hash
  // In a full implementation, this would render server-side HTML with Open Graph tags
  return Response.redirect(`https://navicore.tech/#track/${trackId}`, 302);
}

async function handleGetTags(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    
    const tags = await getPopularTags(env, limit);
    
    return new Response(JSON.stringify({
      tags: tags,
      count: tags.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get tags error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch tags', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
