/**
 * Music App with Amazon Music API & FFmpeg WASM Decryption
 */

const PROXY = "https://api.codetabs.com/v1/proxy?quest=";
const API_BASE = "https://t2tunes.site/api/amazon-music/media-from-asin?country=US&codec=opus&asin=";

// ============================================================
// STATE MANAGEMENT
// ============================================================
const State = {
    currentQueue: [],
    currentIndex: 0,
    currentAlbumData: null,
    preloadedIndex: -1,
    preloadedUrl: null
};

const setStatus = (txt) => {
    const el = document.getElementById('status');
    if (el) el.innerText = txt;
};

const formatTime = (s) => {
    if (isNaN(s)) return "0:00";
    return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
async function fetchJSON(url) {
    try {
        const res = await fetch(PROXY + encodeURIComponent(url));
        return res.json();
    } catch (e) {
        console.error('Fetch error:', e);
        return null;
    }
}

// ============================================================
// FFMPEG DECRYPTION MANAGER
// ============================================================
const FFMpegManager = {
    instance: null,
    async get() {
        if (!this.instance) {
            setStatus("Initializing decryptor...");
            const { FFmpeg } = FFmpegWASM;
            this.instance = new FFmpeg();
            await this.instance.load({
                coreURL: 'fcore.js',
                wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
            });
            console.log('FFmpeg WASM loaded');
        }
        return this.instance;
    }
};

// Decrypt stream with FFmpeg and return playable blob URL
async function decryptStream(streamUrl, decryptionKey) {
    try {
        setStatus('Decrypting...');
        const ffmpeg = await FFMpegManager.get();
        
        const res = await fetch(streamUrl);
        const buf = await res.arrayBuffer();
        
        await ffmpeg.writeFile('encrypted.mp4', new Uint8Array(buf));
        await ffmpeg.exec([
            '-decryption_key', decryptionKey,
            '-i', 'encrypted.mp4',
            '-vn', '-acodec', 'copy',
            'output.opus'
        ]);
        
        const decrypted = await ffmpeg.readFile('output.opus');
        const blobUrl = URL.createObjectURL(
            new Blob([decrypted.buffer], { type: 'audio/opus' })
        );
        
        console.log('Decryption successful');
        return blobUrl;
    } catch (error) {
        console.error('Decryption error:', error);
        setStatus(`Error: ${error.message}`);
        return null;
    }
}

// ============================================================
// SEARCH HANDLER
// ============================================================
async function handleSearch(query) {
    if (!query) {
        document.getElementById('results').innerHTML = '';
        return;
    }

    setStatus('Searching Amazon Music...');
    const results = await AmazonAPI.search(query);
    
    if (!results) {
        setStatus('Search failed. Please try again.');
        return;
    }

    const parsed = AmazonAPI.parseData(results, 'search');
    renderSearchResults(parsed);
    setStatus(`Found results for "${query}"`);
}

function renderSearchResults(parsed) {
    if (!parsed || (!parsed.tracks?.length && !parsed.albums?.length && !parsed.playlists?.length)) {
        document.getElementById('results').innerHTML = '<p style="color:var(--dim)">No results found.</p>';
        return;
    }

    let html = '';

    // Render albums first
    if (parsed.albums && parsed.albums.length) {
        html += `<div class="section-header">Albums</div><div class="grid">`;
        parsed.albums.forEach(item => {
            const img = item.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3C/svg%3E';
            html += `
                <div class="card" onclick="openViewer('${item.asin}')">
                    <div class="img-wrap"><img src="${img}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23333%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E'"></div>
                    <div class="title">${item.title || 'Unknown'}</div>
                    <div class="sub">${item.subtitle || ''}</div>
                </div>`;
        });
        html += '</div>';
    }

    // Render playlists
    if (parsed.playlists && parsed.playlists.length) {
        html += `<div class="section-header">Playlists</div><div class="grid">`;
        parsed.playlists.forEach(item => {
            const img = item.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3C/svg%3E';
            html += `
                <div class="card" onclick="openViewer('${item.asin}')">
                    <div class="img-wrap"><img src="${img}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23333%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E'"></div>
                    <div class="title">${item.title || 'Unknown'}</div>
                    <div class="sub">${item.subtitle || ''}</div>
                </div>`;
        });
        html += '</div>';
    }

    // Render tracks
    if (parsed.tracks && parsed.tracks.length) {
        html += `<div class="section-header">Tracks</div><div class="grid">`;
        parsed.tracks.forEach(item => {
            const img = item.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3C/svg%3E';
            html += `
                <div class="card" onclick="playTrack('${item.asin}')">
                    <div class="img-wrap"><img src="${img}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23333%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E'"></div>
                    <div class="title">${item.title || 'Unknown'}</div>
                    <div class="sub">${item.subtitle || ''}</div>
                </div>`;
        });
        html += '</div>';
    }

    document.getElementById('results').innerHTML = html;
}

// ============================================================
// ALBUM VIEWER
// ============================================================
async function openViewer(asin) {
    const viewer = document.getElementById('viewer');
    const container = document.getElementById('viewer-data');
    viewer.style.display = 'block';
    document.body.style.overflow = 'hidden';
    container.innerHTML = '<div style="padding:20px; color:var(--dim);">Loading album...</div>';

    try {
        const data = await fetchJSON(API_BASE + asin);
        if (!data || (Array.isArray(data) && data.length === 0)) {
            container.innerHTML = '<div style="padding:20px; color:var(--dim);">Failed to load album</div>';
            return;
        }

        const tracks = Array.isArray(data) ? data : [data];
        State.currentQueue = tracks;
        State.currentAlbumData = tracks;
        
        const first = tracks[0];
        const cover = first.templateCoverUrl ? first.templateCoverUrl.replace('{size}', '500').replace('{jpegQuality}', '90').replace('{format}', 'jpg') : '';

        let html = `
            <div style="display:flex; gap:30px; margin-bottom:40px;">
                <div style="flex-shrink:0;">
                    <img src="${cover}" style="width:250px; height:250px; border-radius:8px; background:#333;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 250 250%22%3E%3Crect fill=%22%23333%22 width=%22250%22 height=%22250%22/%3E%3C/svg%3E'">
                </div>
                <div style="flex:1;">
                    <h2 style="margin:0 0 10px 0;">${first.tags?.album || 'Album'}</h2>
                    <p style="margin:0 0 20px 0; color:var(--dim);">${first.tags?.artist || 'Artist'}</p>
                    <button onclick="playFromQueue(0)" style="padding:10px 20px; background:var(--accent); border:none; border-radius:4px; color:#000; font-weight:bold; cursor:pointer; font-size:14px;">Play Album</button>
                </div>
            </div>

            <h3 style="margin:30px 0 15px 0;">Tracklist</h3>
            <div style="display:flex; flex-direction:column; gap:8px;">
        `;

        tracks.forEach((track, i) => {
            const title = track.tags?.title || `Track ${i + 1}`;
            const artist = track.tags?.artist || '';
            html += `
                <div style="padding:12px; background:#1a1a1a; border-radius:4px; display:flex; align-items:center; gap:15px; transition:background 0.2s;" onmouseover="this.style.background='#2a2a2a'" onmouseout="this.style.background='#1a1a1a'">
                    <span style="color:var(--dim); font-size:12px; min-width:30px;">${i + 1}</span>
                    <div style="flex:1; cursor:pointer;" onclick="playFromQueue(${i})">
                        <div style="font-weight:500;">${title}</div>
                        <div style="font-size:12px; color:var(--dim);">${artist}</div>
                    </div>
                    <button onclick="downloadTrack(${i})" style="padding:6px 12px; background:#333; border:1px solid var(--accent); color:var(--accent); border-radius:4px; cursor:pointer; font-size:12px; transition:all 0.2s;" onmouseover="this.style.background=getComputedStyle(document.documentElement).getPropertyValue('--accent'); this.style.color='#000';" onmouseout="this.style.background='#333'; this.style.color=getComputedStyle(document.documentElement).getPropertyValue('--accent');">⬇ Download</button>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Viewer error:', err);
        container.innerHTML = '<div style="padding:20px; color:var(--dim);">Failed to load album data.</div>';
    }
}

function closeViewer() {
    document.getElementById('viewer').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// ============================================================
// DOWNLOAD TRACK
// ============================================================
async function downloadTrack(index) {
    if (index < 0 || index >= State.currentQueue.length) {
        setStatus('Invalid track');
        return;
    }

    const track = State.currentQueue[index];
    const streamUrl = track.streamInfo?.streamUrl;
    const decryptionKey = track.decryptionKey;
    const title = track.tags?.title || `Track ${index + 1}`;
    const artist = track.tags?.artist || 'Unknown';
    const filename = `${artist} - ${title}.opus`;

    setStatus(`Downloading: ${filename}...`);

    try {
        let audioData;

        if (decryptionKey) {
            // Decrypt with FFmpeg
            console.log('Decrypting for download:', filename);
            const ffmpeg = await FFMpegManager.get();
            
            const res = await fetch(streamUrl);
            const buf = await res.arrayBuffer();
            
            await ffmpeg.writeFile('encrypted_dl.mp4', new Uint8Array(buf));
            await ffmpeg.exec([
                '-decryption_key', decryptionKey,
                '-i', 'encrypted_dl.mp4',
                '-vn', '-acodec', 'copy',
                'output_dl.opus'
            ]);
            
            const decrypted = await ffmpeg.readFile('output_dl.opus');
            audioData = decrypted.buffer;
        } else {
            // Direct download (non-encrypted)
            console.log('Direct download:', filename);
            const res = await fetch(streamUrl);
            audioData = await res.arrayBuffer();
        }

        // Create blob and trigger download
        const blob = new Blob([audioData], { type: 'audio/opus' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatus(`Downloaded: ${filename}`);
        console.log('Download complete:', filename);
    } catch (error) {
        console.error('Download error:', error);
        setStatus(`Download failed: ${error.message}`);
    }
}

// Download currently playing track from player
async function downloadCurrentTrack() {
    if (!State.currentQueue || State.currentQueue.length === 0) {
        setStatus('No track playing');
        return;
    }
    await downloadTrack(State.currentIndex);
}

// ============================================================
// ALBUM/PLAYLIST PLAYER
// ============================================================
async function playAlbum(asin) {
    setStatus('Loading album...');
    const url = API_BASE + asin;
    const data = await fetchJSON(url);
    
    if (!data) {
        setStatus('Failed to load album.');
        return;
    }

    const tracks = Array.isArray(data) ? data : [data];
    State.currentQueue = tracks;
    State.currentIndex = 0;
    State.currentAlbumData = tracks;

    if (tracks.length > 0 && tracks[0].streamInfo?.streamUrl) {
        await playFromQueue(0);
    } else {
        setStatus('No stream available for this album.');
    }
}

// ============================================================
// TRACK PLAYER
// ============================================================
async function playTrack(asin) {
    setStatus('Loading track...');
    const url = API_BASE + asin;
    const data = await fetchJSON(url);
    
    if (!data) {
        setStatus('Failed to load track.');
        return;
    }

    const track = Array.isArray(data) ? data[0] : data;
    State.currentQueue = [track];
    State.currentIndex = 0;
    State.currentAlbumData = track;

    if (track.streamInfo?.streamUrl) {
        await playFromQueue(0);
    } else {
        setStatus('No stream available for this track.');
    }
}

// Universal play function for queue index
async function playFromQueue(index) {
    if (index < 0 || index >= State.currentQueue.length) return;
    
    State.currentIndex = index;
    const track = State.currentQueue[index];
    const audio = document.getElementById('min-audio-main');
    const streamUrl = track.streamInfo?.streamUrl;
    const decryptionKey = track.decryptionKey;

    if (!streamUrl) {
        setStatus('No stream available');
        return;
    }

    try {
        let blobUrl;

        // Check if this track was preloaded
        if (State.preloadedIndex === index && State.preloadedUrl) {
            blobUrl = State.preloadedUrl;
            console.log('Using preloaded stream');
        } else if (decryptionKey) {
            console.log('Encrypted stream detected, using FFmpeg');
            blobUrl = await decryptStream(streamUrl, decryptionKey);
        } else {
            console.log('Non-encrypted stream, direct playback');
            blobUrl = streamUrl;
        }

        if (blobUrl) {
            audio.src = blobUrl;
            await audio.play();
            setStatus(`Playing: ${track.tags?.title || 'Track'}`);
            // Preload next track for gapless playback
            preloadNextTrack();
        }
    } catch (error) {
        console.error('Playback error:', error);
        setStatus('Failed to play track');
    }
}

// ============================================================
// PLAYER LOGIC
// ============================================================
/******************************************************
 * 
 *              player.js (player logic copied pasted)
 * 
 *******************************************************/
const activePlayer = (() => {
    let players = [], currentIndex = 0, queue = [], activeIdx = 0, loadedInputs = [null, null];

    const formatTime = (s) => isNaN(s) ? "0:00" : `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;

    const ensureDOM = () => {
        const a = document.getElementById('min-audio-main');
        if (!a || a.dataset.init) return;
        players = [a, document.getElementById('min-audio-preload')];
        const seek = document.getElementById('m-seek')

        players.forEach((p, i) => {
            p.onplay = () => i === activeIdx && (document.getElementById('m-play').textContent = 'PAUSE');
            p.onpause = () => i === activeIdx && (document.getElementById('m-play').textContent = 'PLAY');
            p.onended = () => i === activeIdx && changeTrack(1);
            p.ontimeupdate = () => {
                if (i !== activeIdx) return;
                const pct = (p.currentTime / p.duration) * 100 || 0;
                document.getElementById('m-bar').style.width = pct + "%";
                document.getElementById('m-current').textContent = formatTime(p.currentTime);
                if (p.duration) document.getElementById('m-total').textContent = formatTime(p.duration);
            };
            p.dataset.init = "true";
        });

        seek.onclick = (e) => {
            const p = players[activeIdx];
            if (p.duration) p.currentTime = ((e.clientX - seek.getBoundingClientRect().left) / seek.offsetWidth) * p.duration;
        };

        document.getElementById('m-play').onclick = () => players[activeIdx].paused ? players[activeIdx].play() : players[activeIdx].pause();
        document.getElementById('m-next').onclick = () => changeTrack(1);
        document.getElementById('m-prev').onclick = () => changeTrack(-1);
    };

    const changeTrack = async (dir) => {
        if (!queue.length) return;
        players[activeIdx].pause();
        currentIndex = (currentIndex + dir + queue.length) % queue.length;
        const target = queue[currentIndex], idleIdx = 1 - activeIdx;

        if (loadedInputs[idleIdx] === target) {
            activeIdx = idleIdx;
            players[activeIdx].play().then(preloadNext);
        } else {
            await playTrack(target);
        }
    };

    const playTrack = async (input) => {
        const url = input
        if (!url) return changeTrack(1);
        loadedInputs[activeIdx] = input;
        players[activeIdx].src = url;
        players[activeIdx].play().then(preloadNext).catch(console.error);
    };

    const preloadNext = async () => {
        const next = queue[(currentIndex + 1) % queue.length], idleIdx = 1 - activeIdx;
        if (queue.length <= 1 || loadedInputs[idleIdx] === next) return;
        const url = next
        if (url) { loadedInputs[idleIdx] = next; players[idleIdx].src = url; players[idleIdx].load(); }
    };

    return {
        init: (id, list = []) => { ensureDOM(); queue = list.length ? list : [id]; currentIndex = 0; playTrack(queue[0]); },
        add: (id) => { ensureDOM(); queue.push(id); if (queue.length === 2) preloadNext(); }
    };
})();

window.startPlayer = activePlayer.init;
window.addToQueue = activePlayer.add;

/******************************************************
 * 
 *              See.js (visualizer copied pasted)
 * 
 *******************************************************/
const canvas = document.querySelector("#visualizer");
const ctx = canvas.getContext("2d");

let audioCtx = null
let analyser = null
let animationTime = 0;

/** Initialize the Web Audio API context and connect the visualizer */
function initAudioContext() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || (window).webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  const source = audioCtx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  draw();
}

/** Animation loop for the frequency visualizer using sigma glyphs */
function draw() {
  requestAnimationFrame(draw);
  if (!analyser) return;
  animationTime += 0.016; // ~60fps

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  canvas.width = innerWidth;
  canvas.height = innerHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw fewer bins for readability/performance when using text glyphs
  const step = Math.max(1, Math.floor(data.length / 80));
  const bins = Math.ceil(data.length / step);
  const slotWidth = canvas.width / bins;
  const sigmaSizeBase = 24;

  const computedStyles = window.getComputedStyle(document.body);
  const mainColor = computedStyles.getPropertyValue("--accent").trim() || "#FF9500";
  const secondaryColor = computedStyles.getPropertyValue("--accent-glow").trim() || "rgba(255, 149, 0, 0.3)";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${sigmaSizeBase}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;

  for (let i = 0, b = 0; i < data.length; i += step, b++) {
    const v = data[i];
    const amp = v / 255;

    // Constant sigma size
    const x = b * slotWidth + slotWidth / 2;

    // Create dramatic vertical movement with smooth wave offset
    const waveOffset = Math.sin(animationTime * 2 + b * 0.15) * 15;
    const y = canvas.height - 30 - amp * (canvas.height * 0.75) + waveOffset;

    // Rotation based on frequency bin and amplitude for spinning effect
    const rotation = (animationTime * 3 + b * 0.3 + amp * 0.5) % (Math.PI * 2);

    // Higher minimum alpha and stronger pulsing for visibility
    const alpha = 0.65 + amp * 0.35;

    const gradient = ctx.createLinearGradient(x, y - sigmaSizeBase, x, y + sigmaSizeBase);
    gradient.addColorStop(0, mainColor);
    gradient.addColorStop(1, secondaryColor);

    // Draw stroke outline for better contrast against background
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = gradient;
    ctx.globalAlpha = alpha;
    ctx.fillText("𝚺", 0, 0);

    // Add subtle black outline for contrast
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    ctx.lineWidth = 0.5;
    ctx.strokeText("𝚺", 0, 0);
    ctx.restore();
  }

  ctx.globalAlpha = 1;
}

// ============================================================
// SEARCH EVENT & INITIALIZATION
// ============================================================
let searchTimer;
document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        handleSearch(e.target.value.trim());
    }, 500);
});

// Initialize audio context and player controls
const audio = document.getElementById('min-audio-main');
const preloadAudio = document.getElementById('min-audio-preload');

// Preload next track for gapless playback
async function preloadNextTrack() {
    const nextIndex = State.currentIndex + 1;
    if (nextIndex >= State.currentQueue.length) return;
    
    // Don't preload if already preloaded
    if (State.preloadedIndex === nextIndex) return;
    
    const nextTrack = State.currentQueue[nextIndex];
    if (!nextTrack?.streamInfo?.streamUrl) return;
    
    try {
        const streamUrl = nextTrack.streamInfo.streamUrl;
        const decryptionKey = nextTrack.decryptionKey;
        
        let blobUrl;
        if (decryptionKey) {
            // Decrypt next track
            const ffmpeg = await FFMpegManager.get();
            const res = await fetch(streamUrl);
            const buf = await res.arrayBuffer();
            
            await ffmpeg.writeFile('preload.mp4', new Uint8Array(buf));
            await ffmpeg.exec([
                '-decryption_key', decryptionKey,
                '-i', 'preload.mp4',
                '-vn', '-acodec', 'copy',
                'preload_out.opus'
            ]);
            
            const decrypted = await ffmpeg.readFile('preload_out.opus');
            blobUrl = URL.createObjectURL(
                new Blob([decrypted.buffer], { type: 'audio/opus' })
            );
        } else {
            // Direct stream
            blobUrl = streamUrl;
        }
        
        State.preloadedUrl = blobUrl;
        State.preloadedIndex = nextIndex;
        preloadAudio.src = blobUrl;
        preloadAudio.load();
    } catch (error) {
        console.error('Preload error:', error);
    }
}

audio.onended = () => {
    if (State.currentIndex < State.currentQueue.length - 1) {
        playFromQueue(State.currentIndex + 1);
        // Preload the track after the one we just started
        preloadNextTrack();
    }
};

audio.ontimeupdate = () => {
    const pct = (audio.currentTime / audio.duration) * 100 || 0;
    document.getElementById('m-bar').style.width = pct + "%";
    document.getElementById('m-current').textContent = formatTime(Math.floor(audio.currentTime));
    if (audio.duration) document.getElementById('m-total').textContent = formatTime(Math.floor(audio.duration));
};

document.getElementById('m-play').onclick = () => {
    audio.paused ? audio.play() : audio.pause();
};

document.getElementById('m-next').onclick = () => {
    playFromQueue(State.currentIndex + 1);
};

document.getElementById('m-prev').onclick = () => {
    playFromQueue(State.currentIndex - 1);
};

document.getElementById('m-download').onclick = () => {
    downloadCurrentTrack();
};

const seek = document.getElementById('m-seek');
seek.onclick = (e) => {
    if (audio.duration) {
        audio.currentTime = ((e.clientX - seek.getBoundingClientRect().left) / seek.offsetWidth) * audio.duration;
    }
};

// Initialize visualizer
initAudioContext();

setStatus('Ready. Search for something!');