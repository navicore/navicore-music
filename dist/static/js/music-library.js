// Music Library Management
// This file contains all the functions needed for the music library page

// Global state
let currentView = 'album';
let allTracks = [];
let searchQuery = '';
let albums = {};
let currentAlbumKey = null;

// Initialize track list
function initializeTrackList() {
    // Load and display library
    fetch('https://api.navicore.tech/api/v1/tracks')
    .then(res => res.json())
    .then(data => {
        allTracks = data.tracks;
        renderLibrary();
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
}

function renderLibrary() {
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
    
    function renderAlbumView(tracks) {
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
                    tracks: []
                };
            }
            albumsMap[key].tracks.push(track);
        });
        
        // Update global albums variable
        albums = albumsMap;
        
        // Sort tracks within albums
        Object.values(albums).forEach(album => {
            album.tracks.sort((a, b) => (a.track_number || 999) - (b.track_number || 999));
        });
        
        // Display albums
        container.innerHTML = '<div class="space-y-6">' + Object.entries(albums).map(([key, album]) => `
            <div class="card bg-base-200 shadow-xl">
                <div class="card-body">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="card-title text-xl">${album.album}</h3>
                            <p class="text-base-content/70">${album.artist}</p>
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
                        </div>
                    </div>
                    
                    <!-- Track list -->
                    <div class="mt-4 space-y-1">
                        ${album.tracks.map((track, index) => `
                            <div class="flex items-center gap-3 p-2 rounded hover:bg-base-300 transition-colors cursor-pointer group"
                                 onclick="playTrack('${track.id}')">
                                <span class="text-sm w-6 text-base-content/50">${track.track_number || index + 1}</span>
                                <div class="flex-1">
                                    <span class="text-sm">${track.title}</span>
                                </div>
                                <span class="text-sm text-base-content/50">
                                    ${formatDuration(track.duration)}
                                </span>
                                <button class="btn btn-xs btn-circle btn-ghost opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
                                    </svg>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('') + '</div>';
    }
    
    function renderGridView(tracks) {
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
                        <div class="aspect-square bg-base-300 rounded mb-2"></div>
                        <h3 class="font-bold text-sm line-clamp-2">${album.album}</h3>
                        <p class="text-xs opacity-70 line-clamp-1">${album.artist}</p>
                    </div>
                </div>
            `).join('') + '</div>';
    }
    
    function renderListView(tracks) {
        const container = document.getElementById('library-container');
        
        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="table table-zebra">
                    <thead>
                        <tr>
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
                                <td class="font-semibold">${track.title}</td>
                                <td>${track.artist}</td>
                                <td>${track.album}</td>
                                <td>${formatDuration(track.duration)}</td>
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
    
    function setView(view) {
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
    }
    
    function handleSearch(event) {
        searchQuery = event.target.value;
        renderLibrary();
    }

function formatDuration(seconds) {
    if (!seconds) return '-:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function playTrack(trackId) {
    // Find the track data and its position in all tracks
    const trackIndex = allTracks.findIndex(t => t.id === trackId);
    if (trackIndex !== -1 && window.audioPlayer) {
        // Set all tracks as playlist starting from this track
        window.audioPlayer.setPlaylist(allTracks, trackIndex);
        window.audioPlayer.play();
    }
}

function playAlbum(albumKey) {
    const album = albums[albumKey];
    if (album && album.tracks.length > 0 && window.audioPlayer) {
        // Set album tracks as playlist
        window.audioPlayer.setPlaylist(album.tracks, 0);
        window.audioPlayer.play();
    }
}

function editAlbum(albumKey) {
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

function updateTrackList(album) {
    const trackList = document.getElementById('album-tracks');
    trackList.innerHTML = album.tracks.map(track => `
        <div class="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
            <span class="text-lg font-semibold w-8">${track.track_number || '-'}</span>
            <div class="flex-1">
                <p class="font-semibold">${track.title}</p>
                <p class="text-sm opacity-70">${formatDuration(track.duration)} • ${formatFileSize(track.file_size)}</p>
            </div>
            <button class="btn btn-sm btn-error btn-outline" 
                    onclick="removeTrack('${track.id}', '${track.title.replace(/'/g, "\\'")}')">
                Remove
            </button>
        </div>
    `).join('');
}

function showAddTrackForm() {
    document.getElementById('add-track-form').classList.remove('hidden');
}

function hideAddTrackForm() {
    document.getElementById('add-track-form').classList.add('hidden');
    document.getElementById('new-track-file').value = '';
    document.getElementById('new-track-title').value = '';
    document.getElementById('new-track-number').value = '';
}

async function uploadNewTrack() {
    const album = albums[currentAlbumKey];
    const fileInput = document.getElementById('new-track-file');
    const titleInput = document.getElementById('new-track-title');
    const numberInput = document.getElementById('new-track-number');
    
    if (!fileInput.files[0]) {
        alert('Please select a file');
        return;
    }
    
    const file = fileInput.files[0];
    const title = titleInput.value || extractTrackName(file.name);
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

async function removeTrack(trackId, trackTitle) {
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

async function deleteAlbum() {
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

function closeEditModal() {
    document.getElementById('album-edit-modal').close();
    hideAddTrackForm();
}

function extractTrackName(filename) {
    let name = filename.replace(/\.[^/.]+$/, '');
    name = name.replace(/^\d+[\s\-_.]*/, '');
    name = name.replace(/[\-_]/g, ' ').trim();
    return name || filename;
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}