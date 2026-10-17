/**
 * SPOTIFY FULL-SONG PLAYBACK & SEARCH RUNTIME
 * Integrates:
 * 1. Hybrid Search (Live Apple Music/iTunes metadata + Curated hits)
 * 2. Full-Length Audio/Video Engine via YouTube IFrame API & Local Resolver
 * 3. Continuous Queue Autoplay ("listen to all songs")
 * 4. UBI Telemetry & REA Evidence Tracking
 */

// ==========================================================================
// 1. CURATED CATALOG & BROWSE CATEGORIES
// ==========================================================================

const BROWSE_CATEGORIES = [
  { id: 'music', title: 'Music', color: '#dc148c', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80' },
  { id: 'podcasts', title: 'Podcasts', color: '#006450', image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&auto=format&fit=crop&q=80' },
  { id: 'live-events', title: 'Live Events', color: '#8400e7', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=80' },
  { id: 'made-for-you', title: 'Made For You', color: '#1e3264', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&auto=format&fit=crop&q=80' },
  { id: 'new-releases', title: 'New Releases', color: '#e8115b', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&auto=format&fit=crop&q=80' },
  { id: 'pop', title: 'Pop', color: '#148a08', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200&auto=format&fit=crop&q=80' },
  { id: 'hip-hop', title: 'Hip-Hop', color: '#bc5900', image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=200&auto=format&fit=crop&q=80' },
  { id: 'rock', title: 'Rock', color: '#e91429', image: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=200&auto=format&fit=crop&q=80' },
  { id: 'latin', title: 'Latin', color: '#e1118c', image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&auto=format&fit=crop&q=80' },
  { id: 'dance', title: 'Dance / Electronic', color: '#d84000', image: 'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=200&auto=format&fit=crop&q=80' },
  { id: 'workout', title: 'Workout', color: '#777777', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&auto=format&fit=crop&q=80' },
  { id: 'chill', title: 'Chill', color: '#477d95', image: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=200&auto=format&fit=crop&q=80' }
];

const CURATED_TRACKS = [
  {
    id: 'track-1',
    name: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    albumYear: '2020',
    duration: 200,
    durationFormatted: '3:20',
    artwork: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&auto=format&fit=crop&q=80',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/bc/c7/24/bcc724f1-6a2c-7357-61c3-caef795610ea/mzaf_10793132646399080649.plus.aac.p.m4a',
    youtubeId: 'fHI8X4OXluQ',
    popularity: 98
  },
  {
    id: 'track-2',
    name: 'Starboy',
    artist: 'The Weeknd ft. Daft Punk',
    album: 'Starboy',
    albumYear: '2016',
    duration: 230,
    durationFormatted: '3:50',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/4a/12/35/4a12356c-03d1-dcf3-27dc-473d062828b1/mzaf_15939221295964893883.plus.aac.p.m4a',
    youtubeId: '34Na4j8AVgA',
    popularity: 95
  },
  {
    id: 'track-3',
    name: 'Cruel Summer',
    artist: 'Taylor Swift',
    album: 'Lover',
    albumYear: '2019',
    duration: 178,
    durationFormatted: '2:58',
    artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/64/0e/b5/640eb51b-5136-dcf0-fdf8-dc9bb1a14138/mzaf_9043750860580979455.plus.aac.p.m4a',
    youtubeId: 'ic8j13piAhQ',
    popularity: 97
  },
  {
    id: 'track-4',
    name: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    albumYear: '1975',
    duration: 354,
    durationFormatted: '5:54',
    artwork: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=400&auto=format&fit=crop&q=80',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/8e/3c/64/8e3c647b-7b3b-82a1-026c-d29b1397b985/mzaf_16480746654271887375.plus.aac.p.m4a',
    youtubeId: 'fJ9rUzIMcZQ',
    popularity: 92
  },
  {
    id: 'track-5',
    name: 'Get Lucky',
    artist: 'Daft Punk ft. Pharrell Williams',
    album: 'Random Access Memories',
    albumYear: '2013',
    duration: 248,
    durationFormatted: '4:08',
    artwork: 'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=400&auto=format&fit=crop&q=80',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/c3/09/20/c30920f7-5421-2e67-d86b-4eef11c97a9f/mzaf_17734067208947690623.plus.aac.p.m4a',
    youtubeId: '5NV6Rdv1a3w',
    popularity: 91
  },
  {
    id: 'track-6',
    name: 'BIRDS OF A FEATHER',
    artist: 'Billie Eilish',
    album: 'HIT ME HARD AND SOFT',
    albumYear: '2024',
    duration: 196,
    durationFormatted: '3:16',
    artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/d9/0f/5d/d90f5d52-9b2f-78df-a7fe-d0ec2ff73c24/mzaf_16773352741513222384.plus.aac.p.m4a',
    youtubeId: 'V9PVRfjEBTI',
    popularity: 99
  }
];

const CURATED_ARTISTS = [
  { id: 'artist-weeknd', name: 'The Weeknd', genre: 'R&B / Pop', followers: '115M followers', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80' },
  { id: 'artist-taylor', name: 'Taylor Swift', genre: 'Pop', followers: '108M followers', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80' },
  { id: 'artist-queen', name: 'Queen', genre: 'Classic Rock', followers: '52M followers', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80' },
  { id: 'artist-daft', name: 'Daft Punk', genre: 'Electronic', followers: '34M followers', image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80' },
  { id: 'artist-billie', name: 'Billie Eilish', genre: 'Alternative Pop', followers: '96M followers', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80' }
];

const CURATED_ALBUMS = [
  { id: 'album-after-hours', title: 'After Hours', artist: 'The Weeknd', year: '2020', artwork: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&auto=format&fit=crop&q=80' },
  { id: 'album-lover', title: 'Lover', artist: 'Taylor Swift', year: '2019', artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80' },
  { id: 'album-ram', title: 'Random Access Memories', artist: 'Daft Punk', year: '2013', artwork: 'https://images.unsplash.com/photo-1516873240891-4bf014598ab4?w=300&auto=format&fit=crop&q=80' },
  { id: 'album-hit-hard', title: 'HIT ME HARD AND SOFT', artist: 'Billie Eilish', year: '2024', artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80' }
];

const CURATED_PLAYLISTS = [
  { id: 'playlist-today-top-hits', title: "Today's Top Hits", curator: 'By Spotify · 34M saves', artwork: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=80' },
  { id: 'playlist-mega-hit-mix', title: 'Mega Hit Mix', curator: 'A mega mix of 75 favorites.', artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80' },
  { id: 'playlist-chill-hits', title: 'Chill Hits', curator: 'Kick back to the best chill hits.', artwork: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=300&auto=format&fit=crop&q=80' }
];

// ==========================================================================
// 2. RUNTIME STATE & UBI TELEMETRY
// ==========================================================================

const State = {
  query: '',
  activeCategory: 'all',
  useLiveSearch: true,
  serpId: generateId('serp'),
  requestId: generateId('req'),
  currentTrack: CURATED_TRACKS[0],
  isPlaying: false,
  playbackMode: 'full', // 'full' (YouTube streaming) or 'preview'
  likedTracks: new Set(['track-1']),
  recentSearches: loadRecentSearches(),
  queue: [...CURATED_TRACKS],
  queueIndex: 0,
  isShuffle: false,
  isRepeat: false,
  currentSearchResults: {
    topResult: null,
    tracks: [],
    artists: [],
    albums: [],
    playlists: []
  }
};

function generateId(prefix) {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem('spotify_recent_searches');
    return raw ? JSON.parse(raw) : [CURATED_TRACKS[0], CURATED_ARTISTS[0]];
  } catch (e) {
    return [CURATED_TRACKS[0], CURATED_ARTISTS[0]];
  }
}

function saveRecentSearches() {
  try {
    localStorage.setItem('spotify_recent_searches', JSON.stringify(State.recentSearches.slice(0, 10)));
  } catch (e) {}
}

function addRecentItem(item) {
  State.recentSearches = [item, ...State.recentSearches.filter(i => (i.id || i.name) !== (item.id || item.name))].slice(0, 8);
  saveRecentSearches();
  renderRecentSearches();
}

function removeRecentItem(id, e) {
  if (e) e.stopPropagation();
  State.recentSearches = State.recentSearches.filter(i => (i.id || i.name) !== id);
  saveRecentSearches();
  renderRecentSearches();
  logUbiEvent('hitUiSelect', `remove_recent:${id}`);
}

function logUbiEvent(action, destinationOrParam) {
  const timestamp = new Date().toTimeString().split(' ')[0];
  const logContainer = document.getElementById('evidence-event-log');
  if (logContainer) {
    const entry = document.createElement('div');
    entry.className = 'event-entry fade-in';
    entry.innerHTML = `<span class="event-time">[${timestamp}]</span> <strong>${action}</strong>: ${destinationOrParam} <span style="opacity:0.6;font-size:0.68rem;">(serp:${State.serpId.slice(0,8)})</span>`;
    logContainer.prepend(entry);
    if (logContainer.children.length > 20) {
      logContainer.lastElementChild.remove();
    }
  }

  const queryDisplay = document.getElementById('evidence-active-query');
  if (queryDisplay) {
    const op = State.activeCategory === 'all' ? 'searchDesktop' : `search${capitalize(State.activeCategory)}`;
    queryDisplay.innerHTML = `operation: ${op}
persistedQueryHash: eef7cc54888d91bdd6802623477873caa3948ae173a0c34fd86827b267e94c03
searchTerm: "${State.query}"
category: "${State.activeCategory}"
serpId: ${State.serpId}
requestId: ${State.requestId}`;
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// ==========================================================================
// 3. YOUTUBE FULL-SONG PLAYBACK ENGINE
// ==========================================================================

let ytPlayer = null;
let ytReady = false;
let ytProgressInterval = null;

window.onYouTubeIframeAPIReady = function() {
  ytPlayer = new YT.Player('youtube-player', {
    height: '100%',
    width: '100%',
    videoId: 'fHI8X4OXluQ', // default Blinding Lights
    playerVars: {
      autoplay: 0,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1
    },
    events: {
      onReady: onYtReady,
      onStateChange: onYtStateChange,
      onError: onYtError
    }
  });
};

function onYtReady() {
  ytReady = true;
  console.log('YouTube Full Audio Engine Ready.');
}

function onYtStateChange(event) {
  // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
  if (event.data === YT.PlayerState.PLAYING) {
    State.isPlaying = true;
    updatePlayerUI();
    startYtProgress();
  } else if (event.data === YT.PlayerState.PAUSED) {
    State.isPlaying = false;
    updatePlayerUI();
    stopYtProgress();
  } else if (event.data === YT.PlayerState.ENDED) {
    // CONTINUOUS AUTOPLAY: Next song in queue automatically plays!
    console.log('Song ended, auto-advancing to next song in queue...');
    logUbiEvent('hitTrackEnded', State.currentTrack.name);
    playNextTrack();
  }
}

function onYtError(e) {
  console.warn('YouTube Player error code:', e.data, 'Falling back to preview audio.');
  // Fallback to HTML5 audio if YouTube has embed restriction
  const audio = document.getElementById('audio-engine');
  if (audio && State.currentTrack.previewUrl) {
    audio.src = State.currentTrack.previewUrl;
    audio.play();
  }
}

function startYtProgress() {
  stopYtProgress();
  ytProgressInterval = setInterval(() => {
    if (!ytPlayer || !ytPlayer.getCurrentTime) return;
    const current = ytPlayer.getCurrentTime();
    const duration = ytPlayer.getDuration() || State.currentTrack.duration || 180;
    const pct = Math.min(100, (current / duration) * 100);

    const fill = document.getElementById('timeline-fill');
    const handle = document.getElementById('timeline-handle');
    const timeCurr = document.getElementById('player-current-time');
    const timeTotal = document.getElementById('player-total-time');

    if (fill) fill.style.width = `${pct}%`;
    if (handle) handle.style.left = `${pct}%`;
    if (timeCurr) timeCurr.textContent = formatDuration(current);
    if (timeTotal) timeTotal.textContent = formatDuration(duration);
  }, 250);
}

function stopYtProgress() {
  if (ytProgressInterval) clearInterval(ytProgressInterval);
}

// Resolve full track to YouTube stream & play
async function playFullTrack(track) {
  State.currentTrack = track;
  State.isPlaying = true;
  updatePlayerUI();
  logUbiEvent('hitPlayFullSong', `${track.name} by ${track.artist}`);

  // 1. If we already know the video ID
  let videoId = track.youtubeId;

  // 2. Otherwise resolve via our server
  if (!videoId) {
    try {
      const q = `${track.artist} ${track.name}`;
      const res = await fetch(`/api/resolve-full-song?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.videoId) {
          videoId = data.videoId;
          track.youtubeId = videoId;
        }
      }
    } catch (e) {
      console.warn('Server full-song resolution error:', e);
    }
  }

  // 3. Play through YouTube Player
  if (videoId && ytPlayer && ytReady && ytPlayer.loadVideoById) {
    ytPlayer.loadVideoById(videoId);
    ytPlayer.playVideo();
  } else {
    // Fallback to HTML5 audio preview
    const audio = document.getElementById('audio-engine');
    if (audio && track.previewUrl) {
      audio.src = track.previewUrl;
      audio.play();
    }
  }
}

function togglePlayPause() {
  if (!State.currentTrack) return;
  State.isPlaying = !State.isPlaying;

  if (ytPlayer && ytReady && ytPlayer.getPlayerState) {
    if (State.isPlaying) ytPlayer.playVideo();
    else ytPlayer.pauseVideo();
  } else {
    const audio = document.getElementById('audio-engine');
    if (audio && audio.src) {
      if (State.isPlaying) audio.play();
      else audio.pause();
    }
  }

  updatePlayerUI();
  logUbiEvent(State.isPlaying ? 'hitResume' : 'hitPause', State.currentTrack.name);
}

// Queue Next / Previous
function playNextTrack() {
  if (State.queue.length === 0) return;
  if (State.isShuffle) {
    State.queueIndex = Math.floor(Math.random() * State.queue.length);
  } else {
    State.queueIndex = (State.queueIndex + 1) % State.queue.length;
  }
  const next = State.queue[State.queueIndex];
  playFullTrack(next);
  renderQueueList();
}

function playPrevTrack() {
  if (State.queue.length === 0) return;
  State.queueIndex = (State.queueIndex - 1 + State.queue.length) % State.queue.length;
  const prev = State.queue[State.queueIndex];
  playFullTrack(prev);
  renderQueueList();
}

// "Play All" handler: sets queue to given list and starts track 0
function playAllSongs(songsList) {
  if (!songsList || songsList.length === 0) return;
  State.queue = [...songsList];
  State.queueIndex = 0;
  playFullTrack(State.queue[0]);
  renderQueueList();
  logUbiEvent('hitPlayAll', `Queue length: ${State.queue.length}`);
}

function updatePlayerUI() {
  if (!State.currentTrack) return;

  const track = State.currentTrack;
  const art = document.getElementById('player-track-art');
  if (art) art.src = track.artwork || track.image;
  const name = document.getElementById('player-track-name');
  if (name) name.textContent = track.name || track.title;
  const artist = document.getElementById('player-track-artist');
  if (artist) artist.textContent = track.artist || track.genre || '';

  const heartBtn = document.getElementById('player-heart-btn');
  if (heartBtn) heartBtn.classList.toggle('liked', State.likedTracks.has(track.id));

  // Update play icon
  const playIcon = document.getElementById('main-play-icon');
  if (playIcon) {
    playIcon.innerHTML = State.isPlaying 
      ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }

  // Waveform equalizer bars
  const waveBars = document.getElementById('player-wave-bars');
  if (waveBars) waveBars.style.display = State.isPlaying ? 'inline-flex' : 'none';

  // Highlight active row in search lists
  document.querySelectorAll('.track-row, .full-table-row').forEach(row => {
    const title = row.querySelector('.track-title, .table-song-title')?.textContent;
    const isCurrent = title === track.name;
    row.classList.toggle('active', isCurrent);
  });
}

function renderQueueList() {
  const container = document.getElementById('queue-list');
  if (!container) return;
  container.innerHTML = '';

  State.queue.forEach((track, idx) => {
    const isCurrent = idx === State.queueIndex;
    const row = document.createElement('div');
    row.className = `queue-item-row ${isCurrent ? 'current' : ''}`;
    row.innerHTML = `
      <img class="queue-item-thumb" src="${track.artwork || track.image}" alt="${track.name}">
      <div>
        <div class="queue-item-title">${track.name}</div>
        <div class="queue-item-artist">${track.artist}</div>
      </div>
      <div style="font-size:0.75rem; color:var(--spotify-subdued);">${track.durationFormatted || '3:20'}</div>
    `;
    row.addEventListener('click', () => {
      State.queueIndex = idx;
      playFullTrack(track);
      renderQueueList();
    });
    container.appendChild(row);
  });
}

// ==========================================================================
// 4. SEARCH PIPELINE (HYBRID LIVE API + DEBOUNCE)
// ==========================================================================

let debounceTimer = null;

function onSearchInput(e) {
  const query = e.target.value.trim();
  State.query = query;

  const clearBtn = document.getElementById('search-clear-btn');
  const hint = document.getElementById('search-shortcut-hint');
  if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);
  if (hint) hint.style.display = query.length > 0 ? 'none' : 'block';

  clearTimeout(debounceTimer);

  if (!query) {
    switchView('browse-all');
    document.getElementById('filter-chips-bar').classList.remove('visible');
    logUbiEvent('hitUiNavigate', 'spotify:app:search:empty');
    return;
  }

  document.getElementById('filter-chips-bar').classList.add('visible');
  debounceTimer = setTimeout(() => {
    executeSearch(query);
  }, 280);
}

async function executeSearch(query) {
  State.serpId = generateId('serp');
  State.requestId = generateId('req');
  logUbiEvent('hitSearchQuery', `query="${query}"`);

  let tracks = [];
  let artists = [];
  let albums = [];
  let playlists = [];

  if (State.useLiveSearch) {
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song,album,musicArtist&limit=30`);
      if (res.ok) {
        const data = await res.json();
        (data.results || []).forEach(item => {
          if (item.wrapperType === 'track') {
            tracks.push({
              id: `track-${item.trackId}`,
              name: item.trackName,
              artist: item.artistName,
              album: item.collectionName || 'Single',
              albumYear: (item.releaseDate || '').substring(0, 4),
              duration: Math.round(item.trackTimeMillis / 1000) || 180,
              durationFormatted: formatDuration(Math.round(item.trackTimeMillis / 1000) || 180),
              artwork: (item.artworkUrl100 || '').replace('100x100bb', '400x400bb'),
              previewUrl: item.previewUrl,
              youtubeId: null,
              type: 'track'
            });
          } else if (item.wrapperType === 'artist') {
            artists.push({
              id: `artist-${item.artistId}`,
              name: item.artistName,
              genre: item.primaryGenreName || 'Artist',
              followers: 'Verified Artist',
              image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
              type: 'artist'
            });
          } else if (item.wrapperType === 'collection') {
            albums.push({
              id: `album-${item.collectionId}`,
              title: item.collectionName,
              artist: item.artistName,
              year: (item.releaseDate || '').substring(0, 4),
              artwork: (item.artworkUrl100 || '').replace('100x100bb', '400x400bb'),
              type: 'album'
            });
          }
        });
      }
    } catch (err) {
      console.warn('Live search fallback to curated catalog:', err);
    }
  }

  // Fallback to local curated
  const qLower = query.toLowerCase();
  const localTracks = CURATED_TRACKS.filter(t => t.name.toLowerCase().includes(qLower) || t.artist.toLowerCase().includes(qLower));
  const localArtists = CURATED_ARTISTS.filter(a => a.name.toLowerCase().includes(qLower) || a.genre.toLowerCase().includes(qLower));
  const localAlbums = CURATED_ALBUMS.filter(a => a.title.toLowerCase().includes(qLower) || a.artist.toLowerCase().includes(qLower));
  const localPlaylists = CURATED_PLAYLISTS.filter(p => p.title.toLowerCase().includes(qLower) || p.curator.toLowerCase().includes(qLower));

  tracks = [...tracks, ...localTracks];
  artists = [...artists, ...localArtists];
  albums = [...albums, ...localAlbums];
  playlists = [...playlists, ...localPlaylists];

  let topResult = null;
  if (artists.length > 0 && artists[0].name.toLowerCase() === qLower) {
    topResult = { ...artists[0], kind: 'Artist' };
  } else if (tracks.length > 0) {
    topResult = { ...tracks[0], kind: 'Song' };
  } else if (artists.length > 0) {
    topResult = { ...artists[0], kind: 'Artist' };
  } else if (albums.length > 0) {
    topResult = { ...albums[0], kind: 'Album' };
  }

  State.currentSearchResults = { topResult, tracks, artists, albums, playlists };

  if (!topResult && tracks.length === 0 && artists.length === 0) {
    switchView('empty');
    document.getElementById('empty-title').textContent = `No results found for "${query}"`;
  } else {
    if (State.activeCategory === 'all') {
      renderOverviewResults();
      switchView('results');
    } else {
      renderDrilldownResults(State.activeCategory);
      switchView('drilldown');
    }
  }
}

// ==========================================================================
// 5. VIEW BUILDERS (BROWSE ALL, OVERVIEW, DRILLDOWN)
// ==========================================================================

function switchView(viewName) {
  document.getElementById('view-browse-all').style.display = viewName === 'browse-all' ? 'block' : 'none';
  document.getElementById('view-search-results').style.display = viewName === 'results' ? 'block' : 'none';
  document.getElementById('view-category-drilldown').style.display = viewName === 'drilldown' ? 'block' : 'none';
  document.getElementById('empty-search-state').classList.toggle('visible', viewName === 'empty');
}

function renderBrowseAll() {
  const grid = document.getElementById('browse-categories-grid');
  if (!grid) return;
  grid.innerHTML = '';

  BROWSE_CATEGORIES.forEach(cat => {
    const tile = document.createElement('div');
    tile.className = 'category-tile';
    tile.style.backgroundColor = cat.color;
    tile.innerHTML = `
      <div class="category-tile-title">${cat.title}</div>
      <img class="category-tile-artwork" src="${cat.image}" alt="${cat.title}" loading="lazy">
    `;
    tile.addEventListener('click', () => {
      const input = document.getElementById('search-input');
      input.value = cat.title;
      input.focus();
      onSearchInput({ target: input });
      logUbiEvent('hitUiNavigate', `genre/${cat.id}`);
    });
    grid.appendChild(tile);
  });

  renderRecentSearches();
}

function renderRecentSearches() {
  const container = document.getElementById('recent-searches-container');
  const grid = document.getElementById('recent-searches-grid');
  if (!container || !grid) return;

  if (State.recentSearches.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  grid.innerHTML = '';

  State.recentSearches.slice(0, 6).forEach(item => {
    const card = document.createElement('div');
    card.className = 'recent-search-card';
    const isArtist = item.kind === 'Artist' || item.genre || item.followers;
    const title = item.name || item.title;
    const sub = isArtist ? 'Artist' : (item.artist || 'Song');
    const image = item.image || item.artwork;

    card.innerHTML = `
      <button class="recent-dismiss-btn" title="Remove from recent searches">&times;</button>
      <div class="recent-card-image-box ${isArtist ? 'circle' : ''}">
        <img class="recent-card-image" src="${image}" alt="${title}">
      </div>
      <div class="shelf-card-title">${title}</div>
      <div class="shelf-card-desc">${sub}</div>
      ${!isArtist ? `
        <button class="card-floating-play-btn" title="Play ${title}">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
      ` : ''}
    `;

    card.querySelector('.recent-dismiss-btn').addEventListener('click', (e) => {
      removeRecentItem(item.id || item.name, e);
    });

    card.addEventListener('click', () => {
      if (!isArtist) {
        playFullTrack(item);
      } else {
        const input = document.getElementById('search-input');
        input.value = title;
        onSearchInput({ target: input });
      }
      logUbiEvent('hitUiSelect', `recent_search:${title}`);
    });

    grid.appendChild(card);
  });
}

function renderOverviewResults() {
  const { topResult, tracks, artists, albums, playlists } = State.currentSearchResults;

  // 1. Top Result Card
  const topResultCard = document.getElementById('top-result-card');
  if (topResultCard && topResult) {
    const isArtist = topResult.kind === 'Artist';
    const title = topResult.name || topResult.title;
    const sub = isArtist ? 'Artist' : (topResult.artist || '');
    const image = topResult.image || topResult.artwork;

    topResultCard.innerHTML = `
      <div class="top-result-artwork-box ${isArtist ? 'circle' : ''}">
        <img class="top-result-artwork" src="${image}" alt="${title}">
      </div>
      <div class="top-result-title">${title}</div>
      <div class="top-result-meta-row">
        <span class="top-result-badge">${topResult.kind || 'Song'}</span>
        ${sub ? `<span class="top-result-artist-name">${sub}</span>` : ''}
      </div>
      <button class="card-floating-play-btn" title="Play ${title}">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>
    `;

    topResultCard.onclick = () => {
      addRecentItem(topResult);
      if (!isArtist) {
        playFullTrack(topResult);
      } else {
        setCategoryFilter('artists');
      }
      logUbiEvent('hitTopResult', title);
    };
  }

  // 2. Songs Mini Tracklist (Top 4)
  const songsList = document.getElementById('top-songs-list');
  if (songsList) {
    songsList.innerHTML = '';
    tracks.slice(0, 4).forEach((track) => {
      const isCurrent = State.currentTrack && State.currentTrack.id === track.id;
      const isLiked = State.likedTracks.has(track.id);
      const row = document.createElement('div');
      row.className = `track-row ${isCurrent ? 'active' : ''}`;
      row.innerHTML = `
        <div class="track-row-col-thumb">
          <img class="track-thumb-img" src="${track.artwork}" alt="${track.name}">
          <div class="track-thumb-overlay-play">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="${isCurrent && State.isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/>
            </svg>
          </div>
        </div>
        <div class="track-row-col-main">
          <div class="track-title">${track.name}</div>
          <div class="track-subtitle">${track.artist}</div>
        </div>
        <div class="track-row-col-end">
          <button class="track-heart-btn ${isLiked ? 'liked' : ''}" title="Save to Your Library">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </button>
          <span class="track-duration-text">${track.durationFormatted}</span>
        </div>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.track-heart-btn')) {
          toggleLikeTrack(track.id);
          return;
        }
        playFullTrack(track);
        addRecentItem(track);
      });

      songsList.appendChild(row);
    });
  }

  // 3. Shelves
  renderShelf('shelf-artists-section', 'shelf-artists-grid', artists, true, (a) => {
    addRecentItem(a);
    const input = document.getElementById('search-input');
    input.value = a.name;
    onSearchInput({ target: input });
  });

  renderShelf('shelf-albums-section', 'shelf-albums-grid', albums, false, (al) => {
    const input = document.getElementById('search-input');
    input.value = al.title;
    onSearchInput({ target: input });
  });

  renderShelf('shelf-playlists-section', 'shelf-playlists-grid', playlists, false, (p) => {
    playAllSongs(CURATED_TRACKS);
  });
}

function renderShelf(sectionId, gridId, items, isCircle, onClick) {
  const section = document.getElementById(sectionId);
  const grid = document.getElementById(gridId);
  if (!section || !grid) return;

  if (items.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  grid.innerHTML = '';

  items.slice(0, 5).forEach(item => {
    const title = item.name || item.title;
    const sub = item.genre || `${item.year || ''} ${item.artist || item.curator || ''}`;
    const img = item.image || item.artwork;

    const card = document.createElement('div');
    card.className = 'shelf-card';
    card.innerHTML = `
      <div class="shelf-card-art-box ${isCircle ? 'circle' : ''}">
        <img class="shelf-card-art" src="${img}" alt="${title}" loading="lazy">
      </div>
      <div class="shelf-card-title">${title}</div>
      <div class="shelf-card-desc">${sub}</div>
      ${!isCircle ? `
        <button class="card-floating-play-btn" title="Play ${title}">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
      ` : ''}
    `;
    card.addEventListener('click', () => onClick(item));
    grid.appendChild(card);
  });
}

function renderDrilldownResults(category) {
  const container = document.getElementById('drilldown-content-container');
  const titleElem = document.getElementById('drilldown-title');
  if (!container || !titleElem) return;

  container.innerHTML = '';
  const { tracks, artists, albums, playlists } = State.currentSearchResults;

  if (category === 'tracks') {
    titleElem.textContent = 'Songs';
    const table = document.createElement('table');
    table.className = 'full-tracklist-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width:40px; text-align:center;">#</th>
          <th>Title</th>
          <th>Album</th>
          <th style="width:80px; text-align:right;">Duration</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    tracks.forEach((track, index) => {
      const isCurrent = State.currentTrack && State.currentTrack.id === track.id;
      const row = document.createElement('tr');
      row.className = `full-table-row ${isCurrent ? 'active' : ''}`;
      row.innerHTML = `
        <td style="text-align:center; color:var(--spotify-subdued);">${index + 1}</td>
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${track.artwork}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">
            <div>
              <div class="table-song-title" style="font-weight:600;">${track.name}</div>
              <div style="font-size:0.8rem; color:var(--spotify-subdued);">${track.artist}</div>
            </div>
          </div>
        </td>
        <td style="color:var(--spotify-subdued);">${track.album || 'Single'}</td>
        <td style="text-align:right; color:var(--spotify-subdued); font-variant-numeric:tabular-nums;">${track.durationFormatted}</td>
      `;

      row.addEventListener('click', () => {
        playFullTrack(track);
        addRecentItem(track);
      });

      tbody.appendChild(row);
    });

    container.appendChild(table);
  } else if (category === 'artists') {
    titleElem.textContent = 'Artists';
    const grid = document.createElement('div');
    grid.className = 'shelf-cards-grid';
    artists.forEach(a => {
      const card = document.createElement('div');
      card.className = 'shelf-card';
      card.innerHTML = `
        <div class="shelf-card-art-box circle">
          <img class="shelf-card-art" src="${a.image}" alt="${a.name}">
        </div>
        <div class="shelf-card-title">${a.name}</div>
        <div class="shelf-card-desc">${a.genre || 'Artist'}</div>
      `;
      card.addEventListener('click', () => {
        const input = document.getElementById('search-input');
        input.value = a.name;
        onSearchInput({ target: input });
      });
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }
}

function setCategoryFilter(category) {
  State.activeCategory = category;
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  if (category === 'all') {
    renderOverviewResults();
    switchView('results');
  } else {
    renderDrilldownResults(category);
    switchView('drilldown');
  }
  logUbiEvent('hitFilterChip', `category=${category}`);
}

function toggleLikeTrack(trackId) {
  if (State.likedTracks.has(trackId)) {
    State.likedTracks.delete(trackId);
    logUbiEvent('hitRemoveLike', trackId);
  } else {
    State.likedTracks.add(trackId);
    logUbiEvent('hitLike', trackId);
  }
  updatePlayerUI();
}

// ==========================================================================
// 6. INITIALIZATION & UI CONTROLS
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  renderBrowseAll();
  renderQueueList();

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', onSearchInput);
  }

  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      onSearchInput({ target: searchInput });
      searchInput.focus();
    });
  }

  const clearRecentsBtn = document.getElementById('btn-clear-recents');
  if (clearRecentsBtn) {
    clearRecentsBtn.addEventListener('click', () => {
      State.recentSearches = [];
      saveRecentSearches();
      renderRecentSearches();
    });
  }

  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => setCategoryFilter(btn.dataset.category));
  });

  const seeAllSongs = document.getElementById('btn-see-all-songs');
  if (seeAllSongs) {
    seeAllSongs.addEventListener('click', () => setCategoryFilter('tracks'));
  }

  // PLAY ALL BUTTONS ("listen to all songs" continuously!)
  const btnPlayAllFeatured = document.getElementById('btn-play-all-featured');
  if (btnPlayAllFeatured) {
    btnPlayAllFeatured.addEventListener('click', () => playAllSongs(CURATED_TRACKS));
  }

  const btnPlayAllSongs = document.getElementById('btn-play-all-songs');
  if (btnPlayAllSongs) {
    btnPlayAllSongs.addEventListener('click', () => playAllSongs(State.currentSearchResults.tracks));
  }

  const btnPlayAllDrilldown = document.getElementById('btn-play-all-drilldown');
  if (btnPlayAllDrilldown) {
    btnPlayAllDrilldown.addEventListener('click', () => playAllSongs(State.currentSearchResults.tracks));
  }

  // Player controls
  const mainPlayBtn = document.getElementById('btn-main-play');
  if (mainPlayBtn) mainPlayBtn.addEventListener('click', togglePlayPause);

  const prevBtn = document.getElementById('btn-prev-track');
  if (prevBtn) prevBtn.addEventListener('click', playPrevTrack);

  const nextBtn = document.getElementById('btn-next-track');
  if (nextBtn) nextBtn.addEventListener('click', playNextTrack);

  const shuffleBtn = document.getElementById('btn-shuffle');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      State.isShuffle = !State.isShuffle;
      shuffleBtn.style.color = State.isShuffle ? 'var(--spotify-green)' : 'var(--spotify-subdued)';
      logUbiEvent('hitShuffleToggle', `enabled=${State.isShuffle}`);
    });
  }

  const repeatBtn = document.getElementById('btn-repeat');
  if (repeatBtn) {
    repeatBtn.addEventListener('click', () => {
      State.isRepeat = !State.isRepeat;
      repeatBtn.style.color = State.isRepeat ? 'var(--spotify-green)' : 'var(--spotify-subdued)';
      logUbiEvent('hitRepeatToggle', `enabled=${State.isRepeat}`);
    });
  }

  const playerHeart = document.getElementById('player-heart-btn');
  if (playerHeart) {
    playerHeart.addEventListener('click', () => {
      if (State.currentTrack) toggleLikeTrack(State.currentTrack.id);
    });
  }

  // Seekbar scrubber
  const timelineBar = document.getElementById('timeline-bar');
  if (timelineBar) {
    timelineBar.addEventListener('click', (e) => {
      const rect = timelineBar.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (ytPlayer && ytReady && ytPlayer.getDuration) {
        const dur = ytPlayer.getDuration() || State.currentTrack.duration || 180;
        ytPlayer.seekTo(pos * dur, true);
      }
    });
  }

  // Volume bar
  const volumeBar = document.getElementById('volume-bar');
  if (volumeBar) {
    volumeBar.addEventListener('click', (e) => {
      const rect = volumeBar.getBoundingClientRect();
      const val = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (ytPlayer && ytReady && ytPlayer.setVolume) {
        ytPlayer.setVolume(val * 100);
      }
      document.getElementById('volume-fill').style.width = `${val * 100}%`;
      document.getElementById('volume-handle').style.left = `${val * 100}%`;
    });
  }

  // Toggle Mini-Video Player Dock (PiP)
  const btnTogglePip = document.getElementById('btn-toggle-pip');
  const ytDock = document.getElementById('yt-player-dock');
  const btnCloseYtDock = document.getElementById('btn-close-yt-dock');

  if (btnTogglePip && ytDock) {
    btnTogglePip.addEventListener('click', () => {
      ytDock.classList.toggle('visible');
      btnTogglePip.style.color = ytDock.classList.contains('visible') ? 'var(--spotify-green)' : 'var(--spotify-subdued)';
      logUbiEvent('hitToggleMiniPlayer', ytDock.classList.contains('visible'));
    });
  }

  if (btnCloseYtDock && ytDock) {
    btnCloseYtDock.addEventListener('click', () => {
      ytDock.classList.remove('visible');
      if (btnTogglePip) btnTogglePip.style.color = 'var(--spotify-subdued)';
    });
  }

  // Up Next / Queue Drawer Toggle
  const btnToggleQueue = document.getElementById('btn-toggle-queue');
  const queueDrawer = document.getElementById('queue-drawer');
  const btnCloseQueue = document.getElementById('btn-close-queue');

  if (btnToggleQueue && queueDrawer) {
    btnToggleQueue.addEventListener('click', () => {
      queueDrawer.classList.toggle('open');
      btnToggleQueue.style.color = queueDrawer.classList.contains('open') ? 'var(--spotify-green)' : 'var(--spotify-subdued)';
      renderQueueList();
    });
  }

  if (btnCloseQueue && queueDrawer) {
    btnCloseQueue.addEventListener('click', () => {
      queueDrawer.classList.remove('open');
      if (btnToggleQueue) btnToggleQueue.style.color = 'var(--spotify-subdued)';
    });
  }

  // REA Evidence Drawer Toggle
  const btnEvidence = document.getElementById('btn-toggle-evidence');
  const drawer = document.getElementById('evidence-drawer');
  const btnCloseEvidence = document.getElementById('btn-close-evidence');

  if (btnEvidence && drawer) {
    btnEvidence.addEventListener('click', () => drawer.classList.toggle('open'));
  }
  if (btnCloseEvidence && drawer) {
    btnCloseEvidence.addEventListener('click', () => drawer.classList.remove('open'));
  }

  // Live source toggle button
  const liveToggle = document.getElementById('btn-toggle-live');
  if (liveToggle) {
    liveToggle.addEventListener('click', () => {
      State.useLiveSearch = !State.useLiveSearch;
      liveToggle.classList.toggle('active', State.useLiveSearch);
      liveToggle.querySelector('span:last-child').textContent = State.useLiveSearch ? 'Live Music Engine' : 'Curated Offline';
      if (State.query) executeSearch(State.query);
    });
  }

  // Navigation back button
  const backBtn = document.getElementById('btn-history-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (State.activeCategory !== 'all') {
        setCategoryFilter('all');
      } else {
        searchInput.value = '';
        onSearchInput({ target: searchInput });
      }
    });
  }

  // Global Keyboard Shortcuts (Ctrl+K or '/' to focus search)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement !== searchInput)) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    // Spacebar to toggle play/pause when not in search input
    if (e.code === 'Space' && document.activeElement !== searchInput) {
      e.preventDefault();
      togglePlayPause();
    }
  });

  updatePlayerUI();
  logUbiEvent('hitSessionStart', 'desktop-find.browseAll');
});
