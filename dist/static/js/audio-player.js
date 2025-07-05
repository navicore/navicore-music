// Audio Player Module
class AudioPlayer {
  constructor() {
    this.currentTrack = null;
    this.audio = new Audio();
    this.isPlaying = false;
    this.currentTheme = localStorage.getItem('player-theme') || 'analog-lab';
    this.visualizer = null;
    this.analyser = null;
    this.audioContext = null;
    
    this.init();
  }
  
  init() {
    this.createPlayerElement();
    this.attachEventListeners();
    this.applyTheme(this.currentTheme);
    this.initAudioContext();
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
  
  initAudioContext() {
    this.audio.addEventListener('play', () => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        
        const source = this.audioContext.createMediaElementSource(this.audio);
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        
        this.startVisualizer();
      }
    });
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
    this.audio.src = `https://api.navicore.tech/api/v1/tracks/${track.id}/stream`;
    
    // Update UI
    document.querySelector('.track-title').textContent = track.title;
    document.querySelector('.track-artist').textContent = track.artist;
    
    // Show player if hidden
    const player = document.getElementById('audio-player');
    player.classList.remove('hidden');
    
    // Update album art if available
    if (track.album_art) {
      document.querySelector('.album-art').src = track.album_art;
    }
  }
  
  togglePlay() {
    if (this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }
  
  play() {
    this.audio.play();
    this.isPlaying = true;
    document.querySelector('.play-icon').style.display = 'none';
    document.querySelector('.pause-icon').style.display = 'block';
  }
  
  pause() {
    this.audio.pause();
    this.isPlaying = false;
    document.querySelector('.play-icon').style.display = 'block';
    document.querySelector('.pause-icon').style.display = 'none';
  }
  
  previous() {
    // TODO: Implement playlist functionality
    console.log('Previous track');
  }
  
  next() {
    // TODO: Implement playlist functionality
    console.log('Next track');
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
    
    // Restart visualizer with new theme
    if (this.visualizer) {
      this.startVisualizer();
    }
  }
  
  startVisualizer() {
    const canvas = document.getElementById('visualizer');
    
    if (this.currentTheme === 'analog-lab') {
      this.visualizer = new AnalogOscilloscope(canvas, this.analyser);
    } else {
      // Future: HolographicSpectrum for space-age theme
      this.visualizer = new AnalogOscilloscope(canvas, this.analyser);
    }
    
    this.visualizer.start();
  }
}

// Analog Oscilloscope Visualizer
class AnalogOscilloscope {
  constructor(canvas, analyser) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.analyser = analyser;
    this.bufferLength = analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.animationId = null;
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
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
    this.ctx.fillStyle = 'rgba(0, 17, 0, 0.1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw grid
    this.drawGrid();
    
    // Draw waveform
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#00ff00';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#00ff00';
    
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
    this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
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

// Initialize player when DOM is ready
let audioPlayer;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    audioPlayer = new AudioPlayer();
    window.audioPlayer = audioPlayer;
  });
} else {
  audioPlayer = new AudioPlayer();
  window.audioPlayer = audioPlayer;
}