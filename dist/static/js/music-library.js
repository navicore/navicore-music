// Music Library Management
// This file contains all the functions needed for the music library page

// Global state
let currentView = 'album';
let allTracks = [];
let searchQuery = '';
let albums = {};
let currentAlbumKey = null;

// Pagination settings
const ITEMS_PER_PAGE = 20; // Albums per page
let currentPage = 1;

// Initialize track list
window.initializeTrackList = function() {
    // Get current page from window if set
    if (window.currentPage) {
        currentPage = window.currentPage;
        delete window.currentPage; // Clean up
    }
    
    // Load and display library
    fetch('https://api.navicore.tech/api/v1/tracks')
    .then(res => {
        return res.json();
    })
    .then(data => {
        // Debug: Check if any tracks have cover_art_path
        const tracksWithCovers = (data.tracks || []).filter(t => t.cover_art_path);
        if (tracksWithCovers.length > 0) {
            console.log(`Found ${tracksWithCovers.length} tracks with cover art:`, tracksWithCovers.map(t => ({
                title: t.title,
                album: t.album,
                cover_art_path: t.cover_art_path
            })));
        } else {
            console.log('No tracks have cover_art_path set');
        }
        allTracks = data.tracks || [];
        renderLibrary();
        
        // Check if we need to navigate to a specific album or track
        const hash = window.location.hash;
        if (hash.startsWith('#album/')) {
            const albumKey = decodeURIComponent(hash.substring(7));
            window.showAlbumDetails(albumKey);
        } else if (hash.startsWith('#track/')) {
            const trackId = hash.substring(7);
            window.playTrack(trackId);
        } else if (window.currentAlbumToView) {
            window.showAlbumDetails(window.currentAlbumToView);
            window.currentAlbumToView = null;
        } else if (window.currentTrackToPlay) {
            window.playTrack(window.currentTrackToPlay);
            window.currentTrackToPlay = null;
        }
    })
    .catch(err => {
        console.error('Failed to load library:', err);
        const container = document.getElementById('library-container');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-error">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>Failed to load your music library. Please try again later.</span>
                </div>
            `;
        }
    });
};

window.renderLibrary = function() {
    const container = document.getElementById('library-container');
    if (!container) return;
    
    if (allTracks.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                    <svg class="w-16 h-16 mx-auto mb-4 text-base-content/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                    </svg>
                    <p class="text-lg text-base-content/70">No music available yet</p>
                    <p class="text-sm text-base-content/50 mt-2">Upload some albums to get started</p>
                    <div class="mt-6">
                        <a href="/upload.html" 
                           hx-get="/templates/upload.html" 
                           hx-target="#main-content" 
                           hx-push-url="/upload.html"
                           class="btn btn-primary btn-lg">Upload Your First Album</a>
                    </div>
                </div>
            `;
            return;
        }
        
        // Filter tracks based on search
        let filteredTracks = allTracks;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredTracks = allTracks.filter(track => 
                track.title.toLowerCase().includes(query) ||
                track.artist.toLowerCase().includes(query) ||
                track.album.toLowerCase().includes(query)
            );
        }
        
        if (filteredTracks.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-lg text-base-content/70">No results found for "${searchQuery}"</p>
                </div>
            `;
            return;
        }
        
        // Render based on current view
        switch (currentView) {
            case 'grid':
                renderGridView(filteredTracks);
                break;
            case 'list':
                renderListView(filteredTracks);
                break;
            case 'album':
            default:
                renderAlbumView(filteredTracks);
                break;
        }
    }
    
    window.renderAlbumView = function(tracks) {
        const container = document.getElementById('library-container');
        
        // Group tracks by album
        const albumsMap = {};
        tracks.forEach(track => {
            const key = `${track.artist}::${track.album}`;
            if (!albumsMap[key]) {
                albumsMap[key] = {
                    artist: track.artist,
                    album: track.album,
                    year: track.year,
                    genre: track.genre,
                    cover_art_path: track.cover_art_path,
                    tracks: []
                };
            }
            // Update cover_art_path if this track has one and the album doesn't
            if (track.cover_art_path && !albumsMap[key].cover_art_path) {
                albumsMap[key].cover_art_path = track.cover_art_path;
            }
            albumsMap[key].tracks.push(track);
        });
        
        // Update global albums variable
        albums = albumsMap;
        
        // Sort tracks within albums
        Object.values(albums).forEach(album => {
            album.tracks.sort((a, b) => (a.track_number || 999) - (b.track_number || 999));
        });
        
        // Get album entries for pagination
        const albumEntries = Object.entries(albums);
        const totalAlbums = albumEntries.length;
        const totalPages = Math.ceil(totalAlbums / ITEMS_PER_PAGE);
        
        // Ensure current page is valid
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        
        // Get albums for current page
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalAlbums);
        const pageAlbums = albumEntries.slice(startIndex, endIndex);
        
        // Build album HTML
        let html = '<div class="space-y-6">';
        
        // Add pagination controls at top if needed
        if (totalPages > 1) {
            html += renderPaginationControls(currentPage, totalPages, totalAlbums);
        }
        
        // Display albums for current page
        html += pageAlbums.map(([key, album]) => `
            <div class="card bg-base-200 shadow-xl"
                 oncontextmenu="event.preventDefault(); copyAlbumLink('${key.replace(/'/g, "\\\\'")}')"
                 title="Right-click to copy album link">
                <div class="card-body">
                    <div class="flex justify-between items-start">
                        <a href="#album/${encodeURIComponent(key)}" 
                           class="block hover:opacity-80 transition-opacity cursor-pointer">
                            <h3 class="card-title text-xl">${album.album}</h3>
                            <p class="text-base-content/70">${album.artist}</p>
                            <p class="text-sm opacity-70 mt-1">
                                ${album.year || 'Unknown year'} 
                                ${album.genre ? `• ${album.genre}` : ''}
                                • ${album.tracks.length} tracks
                            </p>
                        </a>
                        <div class="flex gap-2">
                            <button class="btn btn-sm btn-circle btn-primary" onclick="playAlbum('${key.replace(/'/g, "\\'")}')">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"></path>
                                </svg>
                            </button>
                            <button class="btn btn-sm btn-ghost" onclick="editAlbum('${key.replace(/'/g, "\\'")}')">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                </svg>
                            </button>
                            <button class="btn btn-sm btn-ghost" onclick="copyAlbumLink('${key.replace(/'/g, "\\\\'")}')" title="Copy shareable link">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Track list -->
                    <div class="mt-4 space-y-1">
                        ${album.tracks.map((track, index) => `
                            <a href="#track/${track.id}"
                               class="flex items-center gap-3 p-2 rounded hover:bg-base-300 transition-colors cursor-pointer group block"
                               oncontextmenu="event.preventDefault(); copyTrackLink('${track.id}')"
                               title="Right-click to copy track link">
                                <span class="text-sm w-6 text-base-content/50">${track.track_number || index + 1}</span>
                                <div class="flex-1">
                                    <span class="text-sm">${track.title}</span>
                                </div>
                                <span class="text-sm text-base-content/50">
                                    ${window.formatDuration(track.duration)}
                                </span>
                                <button class="btn btn-xs btn-circle btn-ghost opacity-0 group-hover:opacity-100 transition-opacity"
                                        onclick="event.stopPropagation(); event.preventDefault(); playTrack('${track.id}')">
                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
                                    </svg>
                                </button>
                            </a>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add pagination controls at bottom if needed
        if (totalPages > 1) {
            html += renderPaginationControls(currentPage, totalPages, totalAlbums);
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    window.renderGridView = function(tracks) {
        const container = document.getElementById('library-container');
        
        // Group tracks by album for grid
        const albumsMap = {};
        tracks.forEach(track => {
            const key = `${track.artist}::${track.album}`;
            if (!albumsMap[key]) {
                albumsMap[key] = {
                    artist: track.artist,
                    album: track.album,
                    year: track.year,
                    tracks: []
                };
            }
            albumsMap[key].tracks.push(track);
        });
        
        container.innerHTML = '<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">' + 
            Object.entries(albumsMap).map(([key, album]) => `
                <div class="card bg-base-200 hover:shadow-xl transition-shadow cursor-pointer" 
                     onclick="editAlbum('${key.replace(/'/g, "\\'")}')"">
                    <div class="card-body p-4">
                        <div class="aspect-square bg-base-300 rounded mb-2 overflow-hidden">
                            <img src="${album.cover_art_path ? 
                                `https://api.navicore.tech/api/v1/covers/${encodeURIComponent(album.cover_art_path)}` : 
                                '/static/images/default-album.svg'}" 
                                 alt="${album.album}" 
                                 class="w-full h-full object-cover"
                                 onerror="this.src='/static/images/default-album.svg'">
                        </div>
                        <h3 class="font-bold text-sm line-clamp-2">${album.album}</h3>
                        <p class="text-xs opacity-70 line-clamp-1">${album.artist}</p>
                    </div>
                </div>
            `).join('') + '</div>';
    }
    
    window.renderListView = function(tracks) {
        const container = document.getElementById('library-container');
        
        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="table table-zebra">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Title</th>
                            <th>Artist</th>
                            <th>Album</th>
                            <th>Duration</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tracks.map(track => `
                            <tr>
                                <td>
                                    <div class="w-10 h-10">
                                        <img src="${track.cover_art_path ? 
                                            `https://api.navicore.tech/api/v1/covers/${encodeURIComponent(track.cover_art_path)}` : 
                                            '/static/images/default-album.svg'}" 
                                             alt="${track.album}" 
                                             class="w-full h-full object-cover rounded"
                                             onerror="this.onerror=null; this.src='/static/images/default-album.svg'">
                                    </div>
                                </td>
                                <td class="font-semibold">${track.title}</td>
                                <td>${track.artist}</td>
                                <td>${track.album}</td>
                                <td>${window.formatDuration(track.duration)}</td>
                                <td>
                                    <button class="btn btn-xs btn-circle btn-ghost" onclick="playTrack('${track.id}')">
                                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"></path>
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    window.setView = function(view) {
        currentView = view;
        
        // Update button states
        document.querySelectorAll('[data-view]').forEach(btn => {
            if (btn.dataset.view === view) {
                btn.classList.add('btn-active');
            } else {
                btn.classList.remove('btn-active');
            }
        });
        
        renderLibrary();
    };
    
    window.handleSearch = function(event) {
        searchQuery = event.target.value;
        renderLibrary();
    };

window.formatDuration = function(seconds) {
    if (!seconds) return '-:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

window.playTrack = function(trackId) {
    // Find the track data and its position in all tracks
    const trackIndex = allTracks.findIndex(t => t.id === trackId);
    if (trackIndex !== -1 && window.audioPlayer) {
        // Set all tracks as playlist starting from this track
        window.audioPlayer.setPlaylist(allTracks, trackIndex);
        window.audioPlayer.play();
    }
}

window.playAlbum = function(albumKey) {
    const album = albums[albumKey];
    if (album && album.tracks.length > 0 && window.audioPlayer) {
        // Set album tracks as playlist
        window.audioPlayer.setPlaylist(album.tracks, 0);
        window.audioPlayer.play();
    }
}

window.editAlbum = function(albumKey) {
    currentAlbumKey = albumKey;
    const album = albums[albumKey];
    
    // Update modal header
    document.getElementById('album-info').innerHTML = `
        <div class="bg-base-200 p-4 rounded-lg">
            <h2 class="text-xl font-bold">${album.album}</h2>
            <p class="text-base-content/70">${album.artist}</p>
            <p class="text-sm opacity-70">${album.year || 'Unknown year'} • ${album.genre || 'No genre'}</p>
        </div>
    `;
    
    // Update track list
    updateTrackList(album);
    
    // Show modal
    document.getElementById('album-edit-modal').showModal();
}

window.updateTrackList = function(album) {
    const trackList = document.getElementById('album-tracks');
    trackList.innerHTML = album.tracks.map(track => `
        <div class="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
            <span class="text-lg font-semibold w-8">${track.track_number || '-'}</span>
            <div class="flex-1">
                <p class="font-semibold">${track.title}</p>
                <p class="text-sm opacity-70">${window.formatDuration(track.duration)} • ${window.formatFileSize(track.file_size)}</p>
            </div>
            <button class="btn btn-sm btn-error btn-outline" 
                    onclick="removeTrack('${track.id}', '${track.title.replace(/'/g, "\\'")}')">
                Remove
            </button>
        </div>
    `).join('');
}

window.showAddTrackForm = function() {
    document.getElementById('add-track-form').classList.remove('hidden');
}

window.hideAddTrackForm = function() {
    document.getElementById('add-track-form').classList.add('hidden');
    document.getElementById('new-track-file').value = '';
    document.getElementById('new-track-title').value = '';
    document.getElementById('new-track-number').value = '';
}

window.uploadNewTrack = async function() {
    const album = albums[currentAlbumKey];
    const fileInput = document.getElementById('new-track-file');
    const titleInput = document.getElementById('new-track-title');
    const numberInput = document.getElementById('new-track-number');
    
    if (!fileInput.files[0]) {
        alert('Please select a file');
        return;
    }
    
    const file = fileInput.files[0];
    const title = titleInput.value || window.extractTrackName(file.name);
    const trackNumber = parseInt(numberInput.value) || album.tracks.length + 1;
    
    // Check file size
    if (file.size > 100 * 1024 * 1024) {
        alert('File is too large. Maximum size is 100MB.');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata', JSON.stringify({
            title: title,
            artist: album.artist,
            album: album.album,
            genre: album.genre,
            year: album.year,
            track_number: trackNumber
        }));
        
        const response = await fetch('https://api.navicore.tech/api/v1/upload/file', {
            method: 'POST',
            body: formData,
        });
        
        if (response.ok) {
            hideAddTrackForm();
            // Reload track list
            initializeTrackList();
            closeEditModal();
        } else {
            const error = await response.json();
            alert(`Upload failed: ${error.details || error.error}`);
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed. Please try again.');
    }
}

window.removeTrack = async function(trackId, trackTitle) {
    if (!confirm(`Remove "${trackTitle}" from this album?`)) return;
    
    try {
        const response = await fetch(`https://api.navicore.tech/api/v1/tracks/${trackId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Reload track list
            initializeTrackList();
            closeEditModal();
        } else {
            alert('Failed to remove track');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to remove track');
    }
}

window.deleteAlbum = async function() {
    const album = albums[currentAlbumKey];
    if (!confirm(`Delete entire album "${album.album}" by ${album.artist}?\n\nThis will remove all ${album.tracks.length} tracks.`)) {
        return;
    }
    
    try {
        // Delete all tracks in the album
        for (const track of album.tracks) {
            await fetch(`https://api.navicore.tech/api/v1/tracks/${track.id}`, {
                method: 'DELETE'
            });
        }
        
        closeEditModal();
        // Reload track list
        initializeTrackList();
    } catch (error) {
        console.error('Delete album error:', error);
        alert('Failed to delete album. Some tracks may have been removed.');
        initializeTrackList();
    }
}

window.closeEditModal = function() {
    document.getElementById('album-edit-modal').close();
    hideAddTrackForm();
}

window.extractTrackName = function(filename) {
    let name = filename.replace(/\.[^/.]+$/, '');
    name = name.replace(/^\d+[\s\-_.]*/, '');
    name = name.replace(/[\-_]/g, ' ').trim();
    return name || filename;
}

window.formatFileSize = function(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Show details for a specific album
window.showAlbumDetails = function(albumKey) {
    // First ensure we're in album view
    setView('album');
    
    // Parse the album key
    const [artist, album] = albumKey.split('::');
    
    // Filter the view to show only this album
    const container = document.getElementById('library-container');
    if (!container) return;
    
    // Find the specific album in our data
    const albumData = albums[albumKey];
    if (!albumData) {
        // Album not found, try to find it in allTracks
        const albumTracks = allTracks.filter(track => 
            track.artist === artist && track.album === album
        );
        
        if (albumTracks.length > 0) {
            // Render just this album
            const singleAlbum = {
                [albumKey]: {
                    artist: artist,
                    album: album,
                    year: albumTracks[0].year,
                    genre: albumTracks[0].genre,
                    tracks: albumTracks.sort((a, b) => (a.track_number || 999) - (b.track_number || 999))
                }
            };
            renderSingleAlbum(singleAlbum, albumKey);
        }
    } else {
        // Render just this album
        renderSingleAlbum({ [albumKey]: albumData }, albumKey);
    }
}

// Render a single album view
window.renderSingleAlbum = function(albumObj, albumKey) {
    const container = document.getElementById('library-container');
    const [key, album] = Object.entries(albumObj)[0];
    
    container.innerHTML = `
        <div class="mb-4">
            <button class="btn btn-sm btn-ghost" onclick="window.location.hash = ''; renderLibrary();">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                Back to all albums
            </button>
        </div>
        <div class="card bg-base-200 shadow-xl"
             oncontextmenu="event.preventDefault(); copyAlbumLink('${key.replace(/'/g, "\\\\'")}')"
             title="Right-click to copy album link">
            <div class="card-body">
                <div class="flex gap-6">
                    <div class="w-48 h-48 flex-shrink-0">
                        <img src="${album.cover_art_path ? 
                            `https://api.navicore.tech/api/v1/covers/${encodeURIComponent(album.cover_art_path)}` : 
                            '/static/images/default-album.svg'}" 
                             alt="${album.album}" 
                             class="w-full h-full object-cover rounded-lg shadow-lg"
                             onerror="this.onerror=null; this.src='/static/images/default-album.svg'">
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="card-title text-2xl">${album.album}</h3>
                                <p class="text-lg text-base-content/70">${album.artist}</p>
                                <p class="text-sm opacity-70 mt-1">
                                    ${album.year || 'Unknown year'} 
                                    ${album.genre ? `• ${album.genre}` : ''}
                                    • ${album.tracks.length} tracks
                                </p>
                            </div>
                    <div class="flex gap-2">
                        <button class="btn btn-sm btn-circle btn-primary" onclick="playAlbum('${key.replace(/'/g, "\\'")}')">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="editAlbum('${key.replace(/'/g, "\\'")}')">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="copyAlbumLink('${key.replace(/'/g, "\\\\'")}')" title="Copy shareable link">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                            </svg>
                        </button>
                    </div>
                        </div>
                    </div>
                </div>
                
                <!-- Track list -->
                <div class="mt-6 space-y-1">
                    ${album.tracks.map((track, index) => `
                        <a href="#track/${track.id}"
                           class="flex items-center gap-3 p-3 rounded hover:bg-base-300 transition-colors cursor-pointer group block"
                           oncontextmenu="event.preventDefault(); copyTrackLink('${track.id}')"
                           title="Right-click to copy track link">
                            <span class="text-lg font-semibold w-8">${track.track_number || index + 1}</span>
                            <div class="flex-1">
                                <span class="text-base">${track.title}</span>
                            </div>
                            <span class="text-sm text-base-content/50">
                                ${window.formatDuration(track.duration)}
                            </span>
                            <button class="btn btn-sm btn-circle btn-ghost opacity-0 group-hover:opacity-100 transition-opacity"
                                    onclick="event.stopPropagation(); event.preventDefault(); playTrack('${track.id}')">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
                                </svg>
                            </button>
                        </a>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

// Copy album link to clipboard
window.copyAlbumLink = function(albumKey) {
    const url = `${window.location.origin}/#album/${encodeURIComponent(albumKey)}`;
    
    // Try to use the clipboard API
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            window.showToast('Album link copied to clipboard!');
        }).catch(err => {
            window.fallbackCopyTextToClipboard(url);
        });
    } else {
        window.fallbackCopyTextToClipboard(url);
    }
};

// Copy track link to clipboard
window.copyTrackLink = function(trackId) {
    const url = `${window.location.origin}/#track/${trackId}`;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            window.showToast('Track link copied to clipboard!');
        }).catch(err => {
            window.fallbackCopyTextToClipboard(url);
        });
    } else {
        window.fallbackCopyTextToClipboard(url);
    }
};

// Fallback copy method for older browsers
window.fallbackCopyTextToClipboard = function(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        window.showToast('Link copied to clipboard!');
    } catch (err) {
        window.showToast('Failed to copy link');
    }
    
    document.body.removeChild(textArea);
}

// Show a toast notification
window.showToast = function(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-top toast-center';
    toast.innerHTML = `
        <div class="alert alert-success">
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Update URL and view when clicking albums/tracks
window.updateUrlAndView = function(type, id) {
    if (type === 'album') {
        console.log('updateUrlAndView: navigating to album', id);
        window.location.hash = 'album/' + encodeURIComponent(id);
    } else if (type === 'track') {
        console.log('updateUrlAndView: navigating to track', id);
        window.location.hash = 'track/' + id;
    }
}

// Pagination controls renderer
function renderPaginationControls(currentPage, totalPages, totalItems) {
    let html = '<div class="flex justify-center items-center gap-2 my-6">';
    
    // Previous button
    if (currentPage > 1) {
        html += `<button class="btn btn-sm" onclick="window.goToPage(${currentPage - 1})">← Previous</button>`;
    } else {
        html += `<button class="btn btn-sm btn-disabled">← Previous</button>`;
    }
    
    // Page numbers
    html += '<div class="flex gap-1">';
    
    // Always show first page
    if (currentPage > 3) {
        html += `<button class="btn btn-sm btn-outline" onclick="window.goToPage(1)">1</button>`;
        if (currentPage > 4) {
            html += `<span class="px-2">...</span>`;
        }
    }
    
    // Show pages around current
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        if (i === currentPage) {
            html += `<button class="btn btn-sm btn-active">${i}</button>`;
        } else {
            html += `<button class="btn btn-sm btn-outline" onclick="window.goToPage(${i})">${i}</button>`;
        }
    }
    
    // Always show last page
    if (currentPage < totalPages - 2) {
        if (currentPage < totalPages - 3) {
            html += `<span class="px-2">...</span>`;
        }
        html += `<button class="btn btn-sm btn-outline" onclick="window.goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    html += '</div>';
    
    // Next button
    if (currentPage < totalPages) {
        html += `<button class="btn btn-sm" onclick="window.goToPage(${currentPage + 1})">Next →</button>`;
    } else {
        html += `<button class="btn btn-sm btn-disabled">Next →</button>`;
    }
    
    // Item count
    html += `<span class="text-sm text-base-content/70 ml-4">${totalItems} albums</span>`;
    
    html += '</div>';
    return html;
}

// Navigate to a specific page
window.goToPage = function(page) {
    currentPage = page;
    // Update URL with page number
    if (page > 1) {
        window.location.hash = `music/page/${page}`;
    } else {
        window.location.hash = 'music';
    }
    renderLibrary();
}

