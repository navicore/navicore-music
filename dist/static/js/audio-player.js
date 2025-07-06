// Audio Player Module
class AudioPlayer {
  constructor() {
    // WASM-or-nothing: Check if WASM is ready
    if (!window.wasmAudioReady) {
      throw new Error('AudioPlayer requires WASM audio engine to be initialized first');
    }
    
    this.currentTrack = null;
    this.playlist = [];
    this.currentIndex = -1;
    this.audio = new Audio();
    this.isPlaying = false;
    this.currentTheme = localStorage.getItem('player-theme') || 'analog-lab';
    this.visualizer = null;
    this.analyser = null;
    this.audioContext = null;
    this.source = null;
    this.saveTimer = null;
    
    this.init();
  }
  
  init() {
    this.createPlayerElement();
    this.attachEventListeners();
    this.applyTheme(this.currentTheme);
    this.setupAudioRouting();
    this.restorePlaybackState();
  }
  
  createPlayerElement() {
    const playerHTML = `
      <div id="audio-player" class="audio-player hidden" data-theme="${this.currentTheme}">
        <button class="player-toggle" onclick="audioPlayer.toggleMinimize()">
          <span class="toggle-icon">⏷</span>
        </button>
        
        <div class="player-section player-album">
          <div class="album-art-container">
            <img class="album-art" src="/static/images/default-album.svg" alt="Album Art">
          </div>
        </div>
        
        <div class="player-section player-info">
          <div class="track-display">
            <div class="track-title">No track selected</div>
            <div class="track-artist">Select a song to play</div>
          </div>
          
          <div class="progress-container">
            <div class="progress-bar" onclick="audioPlayer.seek(event)">
              <div class="progress-fill"></div>
            </div>
            <div class="time-display">
              <span class="time-current">0:00</span>
              <span class="time-total">0:00</span>
            </div>
          </div>
          
          <div class="transport-controls">
            <button class="control-btn prev" onclick="audioPlayer.previous()">
              <svg width="24" height="24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>
            
            <button class="control-btn play-pause" onclick="audioPlayer.togglePlay()">
              <svg class="play-icon" width="24" height="24" fill="currentColor" style="display: block">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <svg class="pause-icon" width="24" height="24" fill="currentColor" style="display: none">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            </button>
            
            <button class="control-btn next" onclick="audioPlayer.next()">
              <svg width="24" height="24" fill="currentColor">
                <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="player-section player-visual">
          <canvas id="visualizer"></canvas>
          <div class="vu-meter" style="display: none;">
            <div class="vu-needle"></div>
          </div>
        </div>
      </div>
    `;
    
    // Insert player before the closing body tag
    document.body.insertAdjacentHTML('beforeend', playerHTML);
    
    // Add CSS
    if (!document.querySelector('link[href*="player.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/static/css/player.css';
      document.head.appendChild(link);
    }
  }
  
  setupAudioRouting() {
    // Set up audio routing but don't connect until first play
    this.audio.crossOrigin = "anonymous"; // Enable CORS for audio analysis
    
    // Initialize canvas with waiting message
    const canvas = document.getElementById('visualizer');
    if (canvas) {
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
      
      // Show initial state
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000805';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00ff88';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00ff88';
      ctx.fillText('Waiting for audio...', canvas.width / 2, canvas.height / 2);
    }
  }
  
  initAudioContext() {
    if (this.audioContext) {
      console.log('Audio context already exists');
      return;
    }
    
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      // Only create source if we haven't already
      if (!this.source) {
        // Create source from audio element (can only be done once!)
        this.source = this.audioContext.createMediaElementSource(this.audio);
          
        // Create gain node for proper routing
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 1.0;
        
        // Connect: source -> gain -> destination
        this.source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Also connect source -> analyser (parallel connection)
        this.source.connect(this.analyser);
        
        }
      
      // Start visualizer
      this.startVisualizer();
    } catch (error) {
      console.error('Audio context error:', error);
      // Fallback: ensure audio still plays
      this.audio.play().catch(e => console.error('Playback error:', e));
    }
  }
  
  resizeCanvas() {
    const canvas = document.getElementById('visualizer');
    if (canvas) {
      // Set canvas size to match container
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
  }
  
  attachEventListeners() {
    // Audio events
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
    this.audio.addEventListener('ended', () => this.next());
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      
      switch(e.key) {
        case ' ':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowLeft':
          this.seek(null, -5);
          break;
        case 'ArrowRight':
          this.seek(null, 5);
          break;
      }
    });
  }
  
  loadTrack(track) {
    this.currentTrack = track;
    
    // Important: Set crossOrigin before setting src
    this.audio.crossOrigin = "anonymous";
    this.audio.src = `https://api.navicore.tech/api/v1/tracks/${track.id}/stream`;
    
    // Update UI
    document.querySelector('.track-title').textContent = track.title;
    document.querySelector('.track-artist').textContent = track.artist;
    
    // Show player if hidden
    const player = document.getElementById('audio-player');
    player.classList.remove('hidden');
    
    // Update album art
    const albumArtElement = document.querySelector('.album-art');
    if (track.cover_art_path) {
      // If we have album art, load it from the API
      albumArtElement.src = `https://api.navicore.tech/api/v1/covers/${encodeURIComponent(track.cover_art_path)}`;
    } else {
      // Use default album art
      albumArtElement.src = '/static/images/default-album.svg';
    }
    
    // Save state
    this.savePlaybackState();
  }
  
  togglePlay() {
    if (this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }
  
  play() {
    // Initialize audio context on first play (browser requirement)
    if (!this.audioContext) {
      this.initAudioContext();
    }
    
    // Resume context if suspended
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    const playPromise = this.audio.play();
    
    if (playPromise !== undefined) {
      return playPromise.then(() => {
        this.isPlaying = true;
        document.querySelector('.play-icon').style.display = 'none';
        document.querySelector('.pause-icon').style.display = 'block';
        
        // Start periodic state saving
        this.startStateSaving();
      }).catch(error => {
        this.isPlaying = false;
        throw error;
      });
    }
    
    // Fallback for older browsers
    this.isPlaying = true;
    document.querySelector('.play-icon').style.display = 'none';
    document.querySelector('.pause-icon').style.display = 'block';
    this.startStateSaving();
    return Promise.resolve();
  }
  
  pause() {
    this.audio.pause();
    this.isPlaying = false;
    document.querySelector('.play-icon').style.display = 'block';
    document.querySelector('.pause-icon').style.display = 'none';
    
    // Stop periodic saving and do one final save
    this.stopStateSaving();
    this.savePlaybackState();
  }
  
  previous() {
    if (this.playlist.length === 0) return;
    
    // If more than 3 seconds into the song, restart it
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    
    // Otherwise go to previous track
    this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    this.loadTrack(this.playlist[this.currentIndex]);
    if (this.isPlaying) {
      this.play();
    }
  }
  
  next() {
    if (this.playlist.length === 0) return;
    
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    this.loadTrack(this.playlist[this.currentIndex]);
    if (this.isPlaying) {
      this.play();
    }
  }
  
  setPlaylist(tracks, startIndex = 0) {
    this.playlist = tracks;
    this.currentIndex = startIndex;
    if (tracks.length > 0) {
      this.loadTrack(tracks[startIndex]);
    }
    this.savePlaybackState();
  }
  
  seek(event, offsetSeconds) {
    if (event) {
      const bar = event.currentTarget;
      const rect = bar.getBoundingClientRect();
      const percent = (event.clientX - rect.left) / rect.width;
      this.audio.currentTime = percent * this.audio.duration;
    } else if (offsetSeconds) {
      this.audio.currentTime = Math.max(0, Math.min(
        this.audio.currentTime + offsetSeconds,
        this.audio.duration
      ));
    }
  }
  
  updateProgress() {
    const percent = (this.audio.currentTime / this.audio.duration) * 100;
    document.querySelector('.progress-fill').style.width = `${percent}%`;
    document.querySelector('.time-current').textContent = this.formatTime(this.audio.currentTime);
  }
  
  updateDuration() {
    document.querySelector('.time-total').textContent = this.formatTime(this.audio.duration);
  }
  
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  toggleMinimize() {
    const player = document.getElementById('audio-player');
    player.classList.toggle('minimized');
    const icon = document.querySelector('.toggle-icon');
    icon.textContent = player.classList.contains('minimized') ? '⏶' : '⏷';
  }
  
  applyTheme(themeName) {
    const player = document.getElementById('audio-player');
    player.setAttribute('data-theme', themeName);
    this.currentTheme = themeName;
    localStorage.setItem('player-theme', themeName);
    
    // Restart visualizer with new theme if active
    if (this.visualizer && this.analyser) {
      this.startVisualizer();
    }
  }
  
  startVisualizer() {
    if (!this.analyser) return;
    
    // Stop existing visualizer
    if (this.visualizer) {
      this.visualizer.stop();
    }
    
    const canvas = document.getElementById('visualizer');
    
    if (this.currentTheme === 'analog-lab') {
      this.visualizer = new AnalogOscilloscope(canvas, this.analyser);
    } else {
      // Future: HolographicSpectrum for space-age theme
      this.visualizer = new AnalogOscilloscope(canvas, this.analyser);
    }
    
    this.visualizer.start();
  }
  
  // Playback state persistence methods
  savePlaybackState() {
    if (!this.currentTrack) return;
    
    const state = {
      track: this.currentTrack,
      playlist: this.playlist,
      currentIndex: this.currentIndex,
      position: this.audio.currentTime,
      isPlaying: this.isPlaying,
      timestamp: Date.now()
    };
    
    localStorage.setItem('audioPlayerState', JSON.stringify(state));
  }
  
  restorePlaybackState() {
    const savedState = localStorage.getItem('audioPlayerState');
    if (!savedState) return;
    
    try {
      const state = JSON.parse(savedState);
      
      // Check if state is recent (within last 24 hours)
      const hoursSinceLastSave = (Date.now() - state.timestamp) / (1000 * 60 * 60);
      if (hoursSinceLastSave > 24) {
        localStorage.removeItem('audioPlayerState');
        return;
      }
      
      // Restore playlist and track
      if (state.playlist && state.playlist.length > 0) {
        this.playlist = state.playlist;
        this.currentIndex = state.currentIndex;
        this.loadTrack(state.track);
        
        // Restore position after metadata loads
        this.audio.addEventListener('loadedmetadata', () => {
          if (state.position > 0 && state.position < this.audio.duration) {
            this.audio.currentTime = state.position;
          }
          
          // Note: Auto-play requires user interaction in modern browsers
          // We'll restore the playing state visually but not actually play
          if (state.isPlaying) {
            // Track was playing before reload - click play to resume
          }
        }, { once: true });
      }
    } catch (error) {
      console.error('Failed to restore playback state:', error);
      localStorage.removeItem('audioPlayerState');
    }
  }
  
  startStateSaving() {
    // Save state every 5 seconds while playing
    if (this.saveTimer) return;
    
    this.saveTimer = setInterval(() => {
      if (this.isPlaying && this.currentTrack) {
        this.savePlaybackState();
      }
    }, 5000);
  }
  
  stopStateSaving() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
  }
}

// Analog Oscilloscope Visualizer
class AnalogOscilloscope {
  constructor(canvas, analyser) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.analyser = analyser;
    this.bufferLength = analyser.fftSize;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.animationId = null;
    
    this.resize();
    this.resizeHandler = () => this.resize();
    window.addEventListener('resize', this.resizeHandler);
  }
  
  resize() {
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
  }
  
  start() {
    this.draw();
  }
  
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
  
  draw() {
    this.animationId = requestAnimationFrame(() => this.draw());
    
    this.analyser.getByteTimeDomainData(this.dataArray);
    
    // Clear with slight persistence for phosphor effect
    this.ctx.fillStyle = 'rgba(0, 8, 5, 0.1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw grid
    this.drawGrid();
    
    // Draw waveform
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#00ff88';
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#00ff88';
    
    this.ctx.beginPath();
    
    const sliceWidth = this.canvas.width / this.bufferLength;
    let x = 0;
    
    for (let i = 0; i < this.bufferLength; i++) {
      const v = this.dataArray[i] / 128.0;
      const y = v * this.canvas.height / 2;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
    this.ctx.stroke();
  }
  
  drawGrid() {
    this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.08)';
    this.ctx.lineWidth = 1;
    this.ctx.shadowBlur = 0;
    
    // Vertical lines
    for (let x = 0; x < this.canvas.width; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y < this.canvas.height; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }
}

// WASM-or-nothing: Player is initialized by index.html after WASM loads
// Export the class for dynamic import
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioPlayer };
}