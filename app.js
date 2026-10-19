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
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/bc/58/a4bc5824-2c67-6869-79a0-2f10b28498f3/20UMGIM10357.rgb.jpg/400x400bb.jpg',
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
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/91/9f/bf/919fbfec-3044-8fa2-6800-4b2a47290f84/16UMGIM60447.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a',
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
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/af/81/44af8168-9609-1b85-5048-ada08dceacf3/mzaf_1341699644335558812.plus.aac.p.m4a',
    youtubeId: 'ic8j13piAhQ',
    popularity: 97
  },
  {
    id: 'track-4',
    name: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    albumYear: '1975',
    duration: 355,
    durationFormatted: '5:55',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/8b/0a/ea/8b0aea60-6f4a-195b-5958-cdf459c2333b/602527644271.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/17/fc/1e/17fc1eba-946d-84a9-710b-a0e88ea64209/mzaf_3049006317693088799.plus.aac.p.m4a',
    youtubeId: 'fJ9rUzIMcZQ',
    popularity: 98
  },
  {
    id: 'track-5',
    name: 'Get Lucky',
    artist: 'Daft Punk ft. Pharrell Williams',
    album: 'Random Access Memories',
    albumYear: '2013',
    duration: 370,
    durationFormatted: '6:10',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/57/a5/85/57a585aa-f1bc-7619-881b-f8a04a5541d5/mzaf_6906185026678279401.plus.aac.p.m4a',
    youtubeId: '5NV6Rdv1a3w',
    popularity: 91
  },
  {
    id: 'track-6',
    name: 'BIRDS OF A FEATHER',
    artist: 'Billie Eilish',
    album: 'HIT ME HARD AND SOFT',
    albumYear: '2024',
    duration: 210,
    durationFormatted: '3:30',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/34/31/d3/3431d34e-847f-5d66-df83-0bce688d997e/mzaf_18106743962423782018.plus.aac.p.m4a',
    youtubeId: 'V9PVRfjEBTI',
    popularity: 99
  },
  {
    id: 'track-7',
    name: 'Lose Yourself',
    artist: 'Eminem',
    album: '8 Mile',
    albumYear: '2002',
    duration: 322,
    durationFormatted: '5:22',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/08/23/fc/0823fcd9-cb44-695b-32bf-b3bf51d9f800/00606949351229.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/13/5a/61/135a6154-8ca2-0523-1fa2-f4ac0ea9e1e7/mzaf_13242749689945681184.plus.aac.p.m4a',
    youtubeId: '_Yhyp-_hX2s',
    popularity: 98
  },
  {
    id: 'track-8',
    name: 'Shape of You',
    artist: 'Ed Sheeran',
    album: '÷ (Deluxe)',
    albumYear: '2017',
    duration: 234,
    durationFormatted: '3:54',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/15/e6/e8/15e6e8a4-4190-6a8b-86c3-ab4a51b88288/190295851286.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/c7/4f/44c74f0d-72dc-6143-d4d0-ba14d661ca0d/mzaf_9566898362556366703.plus.aac.p.m4a',
    youtubeId: 'JGwWNGJdvx8',
    popularity: 95
  },
  {
    id: 'track-9',
    name: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    albumYear: '2020',
    duration: 204,
    durationFormatted: '3:24',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6c/11/d6/6c11d681-aa3a-d59e-4c2e-f77e181026ab/190295092665.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a',
    youtubeId: 'TUVcZfQe-Kw',
    popularity: 97
  },
  {
    id: 'track-10',
    name: 'Sunflower',
    artist: 'Post Malone & Swae Lee',
    album: 'Spider-Man: Into the Spider-Verse',
    albumYear: '2018',
    duration: 158,
    durationFormatted: '2:38',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/4b/30/2c/4b302cb6-7a14-5464-4e97-0577e9d0be49/18UMGIM82277.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/98/f0/d6/98f0d67e-f8bf-762d-cac7-1c6b3b6b35dd/mzaf_4543283896248560946.plus.aac.p.m4a',
    youtubeId: 'ApXoWvfEYVU',
    popularity: 97
  },
  {
    id: 'track-11',
    name: 'As It Was',
    artist: 'Harry Styles',
    album: "Harry's House",
    albumYear: '2022',
    duration: 167,
    durationFormatted: '2:47',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2a/19/fb/2a19fb85-2f70-9e44-f2a9-82abe679b88e/886449990061.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/67/10/16/67101606-3869-ca44-6c03-e13d6322cb51/mzaf_1135399237022217274.plus.aac.p.m4a',
    youtubeId: 'H5v3kku4y6Q',
    popularity: 94
  },
  {
    id: 'track-12',
    name: 'Flowers',
    artist: 'Miley Cyrus',
    album: 'Endless Summer Vacation',
    albumYear: '2023',
    duration: 201,
    durationFormatted: '3:21',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/8c/67/ff/8c67ff91-31c3-3fef-1884-ce3ec89f3af4/196589946874.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/68/9e/f7/689ef7fe-14fe-a846-c87f-7d3b2d6344b1/mzaf_4167137058064023087.plus.aac.p.m4a',
    youtubeId: 'G7KNmW9a75Y',
    popularity: 94
  },
  {
    id: 'track-13',
    name: 'Believer',
    artist: 'Imagine Dragons',
    album: 'Evolve',
    albumYear: '2017',
    duration: 204,
    durationFormatted: '3:24',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/11/7a/b8/117ab805-6811-8929-18b9-0fad7baf0c25/17UMGIM98210.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c0/3f/36/c03f367a-b66b-fd0a-a54c-30f8250c4410/mzaf_12768434238801682952.plus.aac.p.m4a',
    youtubeId: '7wtfhZwyrcc',
    popularity: 93
  },
  {
    id: 'track-14',
    name: 'Someone You Loved',
    artist: 'Lewis Capaldi',
    album: 'Divinely Uninspired To A Hellish Extent',
    albumYear: '2018',
    duration: 182,
    durationFormatted: '3:02',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/92/d7/8f/92d78fb1-df3d-049e-c81d-7022808b151f/19UMGIM02973.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e5/c8/17/e5c817e2-7830-091f-8686-d6276d5beaeb/mzaf_5586826958480073790.plus.aac.p.m4a',
    youtubeId: 'zABLecsR5UE',
    popularity: 93
  },
  {
    id: 'track-15',
    name: 'Counting Stars',
    artist: 'OneRepublic',
    album: 'Native',
    albumYear: '2013',
    duration: 257,
    durationFormatted: '4:17',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/25/46/a7/2546a71a-b2bb-b4c9-4c52-a4daa3ae23ca/13UMGIM15076.rgb.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b0/db/7f/b0db7fbe-f8ff-1f67-fe72-ca8185ffbca2/mzaf_15298650366584767800.plus.aac.p.m4a',
    youtubeId: 'hT_nvWreIhg',
    popularity: 92
  },
  {
    id: 'track-16',
    name: 'Viva La Vida',
    artist: 'Coldplay',
    album: 'Viva La Vida',
    albumYear: '2008',
    duration: 241,
    durationFormatted: '4:01',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/52/aa/85/52aa851f-15b7-6322-f91f-df84b15b7b19/190295978044.jpg/400x400bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a3/30/8e/a3308eed-d8b7-e0b3-f09d-5e1b0f4d660a/mzaf_8517946447501075134.plus.aac.p.m4a',
    youtubeId: 'dvgZkm1xWPE',
    popularity: 94
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
  {
    id: 'playlist-today-top-hits',
    title: "Today's Top Hits",
    curator: 'By Spotify • 34M saves',
    description: 'The hottest global tracks right now.',
    artwork: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80',
    trackIds: ['track-1', 'track-3', 'track-6', 'track-9', 'track-10']
  },
  {
    id: 'playlist-mega-hit-mix',
    title: 'Mega Hit Mix',
    curator: 'By Spotify • 12M saves',
    description: 'A mega mix of 75 favorites to keep your energy high.',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    trackIds: ['track-2', 'track-5', 'track-8', 'track-11', 'track-12', 'track-15']
  },
  {
    id: 'playlist-chill-hits',
    title: 'Chill Hits',
    curator: 'By Spotify • 8.5M saves',
    description: 'Kick back to the best soothing pop and acoustic vibes.',
    artwork: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=400&auto=format&fit=crop&q=80',
    trackIds: ['track-6', 'track-13', 'track-14', 'track-9', 'track-3']
  },
  {
    id: 'playlist-rock-classics',
    title: 'Rock Classics',
    curator: 'By Spotify • 11M saves',
    description: 'Rock legends & epic anthems that define generations.',
    artwork: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=400&auto=format&fit=crop&q=80',
    trackIds: ['track-4', 'track-7', 'track-16', 'track-15', 'track-12']
  },
  {
    id: 'playlist-pop-rising',
    title: 'Pop Rising',
    curator: 'By Spotify • 4.2M saves',
    description: 'The hits of tomorrow are here today.',
    artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80',
    trackIds: ['track-3', 'track-6', 'track-10', 'track-11', 'track-13']
  },
  {
    id: 'playlist-all-out-2010s',
    title: 'All Out 2010s',
    curator: 'By Spotify • 14M saves',
    description: 'The biggest and most unforgettable songs of the 2010s.',
    artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80',
    trackIds: ['track-1', 'track-2', 'track-5', 'track-8', 'track-15', 'track-16']
  },
  {
    id: 'playlist-rap-caviar',
    title: 'RapCaviar',
    curator: 'By Spotify • 15M saves',
    description: 'Music at the center of hip-hop culture.',
    artwork: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop&q=80',
    trackIds: ['track-7', 'track-2', 'track-1', 'track-10']
  },
  {
    id: 'playlist-global-butter',
    title: 'Hot Hits Global',
    curator: 'By Spotify • 9.8M saves',
    description: 'Catch every trending chart-topper from Spotify Global 50.',
    artwork: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&auto=format&fit=crop&q=80',
    trackIds: ['track-1', 'track-2', 'track-3', 'track-4', 'track-5', 'track-6', 'track-7', 'track-8']
  }
];

// ==========================================================================
// 2. RUNTIME STATE & UBI TELEMETRY
// ==========================================================================

const LIBRARY_STORAGE_KEY = 'pmusic_user_library_v1';
const LIKED_STORAGE_KEY = 'pmusic_liked_tracks_v1';
const AUTH_TOKEN_KEY = 'pmusic_auth_token_v1';
const AUTH_USER_KEY = 'pmusic_auth_user_v1';

function loadStoredAuth() {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const userRaw = localStorage.getItem(AUTH_USER_KEY);
    const user = userRaw ? JSON.parse(userRaw) : null;
    return { token: token || null, user: user || null };
  } catch (e) {
    return { token: null, user: null };
  }
}

const initialAuth = loadStoredAuth();

function loadLikedTrackIds() {
  try {
    const raw = localStorage.getItem(LIKED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : ['track-1'];
  } catch (e) {
    return ['track-1'];
  }
}

function saveLikedTrackIds() {
  try {
    localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify([...State.likedTracks]));
  } catch (e) {}
}

function loadUserLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Error loading localStorage library:', e);
  }
  return [CURATED_TRACKS[0], CURATED_TRACKS[1], CURATED_TRACKS[2]];
}

const State = {
  query: '',
  activeCategory: 'all',
  useLiveSearch: true,
  serpId: generateId('serp'),
  requestId: generateId('req'),
  currentTrack: CURATED_TRACKS[0],
  isPlaying: false,
  activeEngine: 'none', // 'none' | 'youtube' | 'audio'
  playbackMode: 'full', // 'full' (YouTube streaming) or 'preview'
  likedTracks: new Set(loadLikedTrackIds()),
  libraryTracks: loadUserLibrary(),
  recentSearches: loadRecentSearches(),
  queue: [...CURATED_TRACKS],
  queueIndex: 0,
  isShuffle: false,
  isRepeat: false,
  repeatMode: 'off', // 'off' | 'all' | 'one'
  isLyricsOpen: false,
  currentLyrics: null,
  activeLyricIndex: -1,
  syncedLyricList: [],
  followingArtists: new Set(),
  authToken: initialAuth.token,
  currentUser: initialAuth.user,
  currentSearchResults: {
    topResult: null,
    tracks: [],
    artists: [],
    albums: [],
    playlists: []
  },
  overviewShowAllSongs: false,
  currentPlayingContext: null
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

// ==========================================================================
// PERMANENT USER LIBRARY & CHAT IMPORTER LOGIC
// ==========================================================================

// Floating notification toast banner for feedback
function showBannerToast(msg, duration = 3500) {
  let toast = document.getElementById('pmusic-toast-banner');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pmusic-toast-banner';
    toast.style.cssText = `
      position: fixed;
      bottom: calc(var(--player-height) + 18px);
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #1ed760;
      color: #000;
      font-weight: 700;
      font-size: 0.85rem;
      padding: 10px 22px;
      border-radius: 500px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.7);
      z-index: 9999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg><span>${msg}</span>`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, duration);
}

// Sync library with permanent server database
async function syncServerLibrary() {
  try {
    if (State.authToken) {
      const res = await fetch('/api/user/library', {
        headers: {
          'Authorization': `Bearer ${State.authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tracks)) {
          const remoteKeys = new Set(data.tracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
          let needsRemoteUpdate = false;
          (State.libraryTracks || []).forEach(t => {
            const key = `${t.name}-${t.artist}`.toLowerCase();
            if (!remoteKeys.has(key)) {
              data.tracks.push(t);
              remoteKeys.add(key);
              needsRemoteUpdate = true;
            }
          });

          State.libraryTracks = data.tracks;
          State.libraryTracks.forEach(t => State.likedTracks.add(t.id));
          saveLikedTrackIds();
          saveUserLibrary(State.libraryTracks, needsRemoteUpdate);
          renderSidebarLibrary();
          return;
        }
      } else if (res.status === 401) {
        handleLogout(false);
      }
    }

    // Guest fallback sync
    const res = await fetch('/api/library');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        const existingKeys = new Set(State.libraryTracks.map(t => `${t.name}-${t.artist}`.toLowerCase()));
        let added = false;
        data.tracks.forEach(t => {
          const key = `${t.name}-${t.artist}`.toLowerCase();
          if (!existingKeys.has(key)) {
            State.libraryTracks.push(t);
            existingKeys.add(key);
            added = true;
          }
        });
        if (added) {
          saveUserLibrary(State.libraryTracks, false);
          renderSidebarLibrary();
        }
      }
    }
  } catch (e) {
    // LocalStorage keeps working seamlessly
  }
}

// Save library locally & synchronize to database
function saveUserLibrary(tracks, syncServer = true) {
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(tracks));
  } catch (e) {
    console.error('Error saving library to localStorage:', e);
  }

  if (syncServer) {
    try {
      if (State.authToken) {
        fetch('/api/user/library', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${State.authToken}`
          },
          body: JSON.stringify({ tracks })
        }).catch(() => {});
      } else {
        fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tracks })
        }).catch(() => {});
      }
    } catch (e) {}
  }

  renderSidebarLibrary();
}

// Update authentication UI elements throughout header and sidebar
function updateAuthUI() {
  const headerLoginBtn = document.getElementById('btn-header-login');
  const userProfileWrapper = document.getElementById('user-profile-wrapper');
  const userAvatarInitial = document.getElementById('user-avatar-initial');
  const userDropdownUsername = document.getElementById('user-dropdown-username');
  const sidebarUserCard = document.getElementById('sidebar-user-card');
  const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
  const sidebarUserName = document.getElementById('sidebar-user-name');
  const sidebarUserStatus = document.getElementById('sidebar-user-status');
  const btnSidebarAuth = document.getElementById('btn-sidebar-auth');

  if (State.currentUser && State.authToken) {
    const username = State.currentUser.username || 'User';
    const initial = (username[0] || 'U').toUpperCase();

    if (headerLoginBtn) headerLoginBtn.style.display = 'none';
    if (userProfileWrapper) userProfileWrapper.style.display = 'block';
    if (userAvatarInitial) userAvatarInitial.textContent = initial;
    if (userDropdownUsername) userDropdownUsername.textContent = username;

    if (sidebarUserCard) sidebarUserCard.classList.add('logged-in');
    if (sidebarUserAvatar) sidebarUserAvatar.textContent = initial;
    if (sidebarUserName) sidebarUserName.textContent = username;
    if (sidebarUserStatus) sidebarUserStatus.textContent = '● Synced in Cloud Database';
    if (btnSidebarAuth) btnSidebarAuth.textContent = 'Account';
  } else {
    if (headerLoginBtn) headerLoginBtn.style.display = 'block';
    if (userProfileWrapper) userProfileWrapper.style.display = 'none';
    const popover = document.getElementById('user-dropdown-popover');
    if (popover) popover.style.display = 'none';

    if (sidebarUserCard) sidebarUserCard.classList.remove('logged-in');
    if (sidebarUserAvatar) sidebarUserAvatar.textContent = '?';
    if (sidebarUserName) sidebarUserName.textContent = 'Guest Mode';
    if (sidebarUserStatus) sidebarUserStatus.textContent = 'Log in to save songs anywhere';
    if (btnSidebarAuth) btnSidebarAuth.textContent = 'Log In';
  }
}

let currentAuthMode = 'login'; // 'login' or 'register'

function openAuthModal(mode = 'login') {
  currentAuthMode = mode;
  const overlay = document.getElementById('auth-modal-overlay');
  const alertEl = document.getElementById('auth-alert');
  const loginTab = document.getElementById('auth-tab-login');
  const registerTab = document.getElementById('auth-tab-register');
  const confirmGroup = document.getElementById('auth-confirm-group');
  const title = document.getElementById('auth-modal-title');
  const subtitle = document.getElementById('auth-modal-subtitle');
  const submitLabel = document.getElementById('auth-submit-label');
  const userInput = document.getElementById('auth-username-input');

  if (alertEl) {
    alertEl.style.display = 'none';
    alertEl.textContent = '';
  }

  if (mode === 'register') {
    if (loginTab) loginTab.classList.remove('active');
    if (registerTab) registerTab.classList.add('active');
    if (confirmGroup) confirmGroup.style.display = 'flex';
    if (title) title.textContent = 'Create a Free Account';
    if (subtitle) subtitle.textContent = 'Choose any username & password to permanently save all your songs in the database.';
    if (submitLabel) submitLabel.textContent = 'Create Account & Sync';
  } else {
    if (loginTab) loginTab.classList.add('active');
    if (registerTab) registerTab.classList.remove('active');
    if (confirmGroup) confirmGroup.style.display = 'none';
    if (title) title.textContent = 'Log in to save songs anywhere';
    if (subtitle) subtitle.textContent = 'Log in with any username & password to access your songs on any phone, browser, or laptop.';
    if (submitLabel) submitLabel.textContent = 'Log In';
  }

  if (overlay) overlay.style.display = 'flex';
  if (userInput) {
    setTimeout(() => userInput.focus(), 80);
  }
}

function closeAuthModal() {
  const overlay = document.getElementById('auth-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  const alertEl = document.getElementById('auth-alert');
  if (alertEl) alertEl.style.display = 'none';
}

// ==========================================================================
// HYPERSCALE SECURITY: 3-STEP HANDSHAKE & STREAM LEASE ENGINE
// ==========================================================================

function getClientDeviceMetadata() {
  let deviceId = localStorage.getItem('pmusic_device_id');
  if (!deviceId) {
    deviceId = `dev_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    localStorage.setItem('pmusic_device_id', deviceId);
  }
  return {
    deviceId,
    deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Web Player' : 'Web Player',
    platform: navigator.platform || 'Web',
    canvasHash: (function() {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.fillText("SpotifySecurity", 2, 2);
        return canvas.toDataURL().slice(-16);
      } catch (e) { return 'c_hash_fallback'; }
    })(),
    webdriver: !!navigator.webdriver
  };
}

async function solveClientPoW(nonce, prefix) {
  const enc = new TextEncoder();
  let solution = 0;
  while (solution < 100000) {
    const candidate = `${nonce}:${solution}`;
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(candidate));
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (hex.startsWith(prefix)) {
      return { solution: String(solution), hash: hex };
    }
    solution++;
  }
  return { solution: '0', hash: '' };
}

let streamLeaseInterval = null;
let latestSecurityTelemetry = {
  powLatencyMs: null,
  riskScore: null
};

function startStreamLeaseHeartbeat() {
  if (streamLeaseInterval) clearInterval(streamLeaseInterval);
  if (!State.authToken) return;

  const deviceMeta = getClientDeviceMetadata();

  const pingLease = async () => {
    if (!State.isPlaying || !State.authToken) {
      clearInterval(streamLeaseInterval);
      streamLeaseInterval = null;
      return;
    }

    try {
      const res = await fetch('/api/v1/stream/lease', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${State.authToken}`
        },
        body: JSON.stringify({
          deviceId: deviceMeta.deviceId,
          deviceName: deviceMeta.deviceName
        })
      });

      if (res.status === 409) {
        const data = await res.json();
        if (State.isPlaying) {
          togglePlayPause();
          showBannerToast(data.message || `Audio paused. You are listening on ${data.playingOn || 'another device'}.`, 6000);
        }
        clearInterval(streamLeaseInterval);
        streamLeaseInterval = null;
      }
    } catch (_) {}
  };

  pingLease();
  streamLeaseInterval = setInterval(pingLease, 10000);
}

function stopStreamLeaseHeartbeat() {
  if (streamLeaseInterval) {
    clearInterval(streamLeaseInterval);
    streamLeaseInterval = null;
  }
}

async function handleAuthSubmit() {
  const userInput = document.getElementById('auth-username-input');
  const pwdInput = document.getElementById('auth-password-input');
  const confirmInput = document.getElementById('auth-password-confirm');
  const alertEl = document.getElementById('auth-alert');
  const submitBtn = document.getElementById('btn-auth-submit');
  const spinner = document.getElementById('auth-submit-spinner');

  const username = (userInput ? userInput.value : '').trim();
  const password = (pwdInput ? pwdInput.value : '').trim();
  const confirmPwd = (confirmInput ? confirmInput.value : '').trim();

  function showError(msg) {
    if (alertEl) {
      alertEl.className = 'auth-alert error';
      alertEl.textContent = msg;
      alertEl.style.display = 'block';
    }
  }

  if (!username) {
    showError('Please enter a username.');
    return;
  }
  if (!password) {
    showError('Please enter a password.');
    return;
  }

  if (currentAuthMode === 'register') {
    if (password.length < 4) {
      showError('Password must be at least 4 characters long.');
      return;
    }
    if (password !== confirmPwd) {
      showError('Passwords do not match. Please re-enter.');
      return;
    }
  }

  if (submitBtn) submitBtn.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';

  try {
    let res;
    let data;

    if (currentAuthMode === 'login') {
      // Step 1: Request Security Challenge (Proof-of-Work Handshake)
      let challengePayload = null;
      let powSolution = null;
      let powDurationMs = 0;

      try {
        const chRes = await fetch('/api/v1/auth/challenge', { method: 'POST' });
        if (chRes.ok) {
          const chData = await chRes.json();
          if (chData.success && chData.challenge) {
            challengePayload = chData.challenge;
            // Step 2: Solve Proof-of-Work puzzle on client
            const t0 = performance.now();
            const powRes = await solveClientPoW(challengePayload.nonce, challengePayload.prefix);
            powSolution = powRes.solution;
            powDurationMs = Math.round(performance.now() - t0);
          }
        }
      } catch (e) {
        console.warn('V1 challenge pre-flight skipped or offline:', e);
      }

      // Step 3: Submit Solution, Credentials & Device Signals
      const deviceMeta = getClientDeviceMetadata();
      const loginPayload = {
        email: username,
        password,
        challenge: challengePayload || undefined,
        powSolution: powSolution || undefined,
        powDurationMs,
        deviceInfo: deviceMeta
      };

      res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginPayload)
      });

      data = await res.json();

      // Fallback to legacy endpoint if v1 returned non-auth server failure
      if (!res.ok && res.status !== 401 && res.status !== 403 && res.status !== 429) {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        data = await res.json();
      }
    } else {
      res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          initialLibrary: State.libraryTracks
        })
      });
      data = await res.json();
    }

    if (!res.ok) {
      if (res.status === 429) {
        let retrySeconds = parseInt(res.headers.get('Retry-After') || '15', 10);
        if (isNaN(retrySeconds) || retrySeconds <= 0) retrySeconds = 15;
        showError(`Too many attempts. Unlocking in ${retrySeconds}s...`);

        if (submitBtn) submitBtn.disabled = true;
        let countdown = retrySeconds;
        const timer = setInterval(() => {
          countdown--;
          if (countdown <= 0) {
            clearInterval(timer);
            if (alertEl) alertEl.style.display = 'none';
            if (submitBtn) submitBtn.disabled = false;
          } else {
            showError(`Too many attempts. Unlocking in ${countdown}s...`);
          }
        }, 1000);
        return;
      }
      showError(data.error || 'Authentication failed. Please check credentials.');
      return;
    }
 
    if (powDurationMs !== undefined && powDurationMs !== null) {
      latestSecurityTelemetry.powLatencyMs = powDurationMs;
    }
    if (data && typeof data.riskScore === 'number') {
      latestSecurityTelemetry.riskScore = data.riskScore;
    }

    const token = data.token || (data.tokens && data.tokens.accessToken);
    State.authToken = token;
    State.currentUser = data.user;
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    if (data.user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));

    if (State.isPlaying) {
      startStreamLeaseHeartbeat();
    }

    if (Array.isArray(data.user.library)) {
      const serverKeys = new Set(data.user.library.map(t => `${t.name}-${t.artist}`.toLowerCase()));
      let mergedAny = false;
      State.libraryTracks.forEach(t => {
        const key = `${t.name}-${t.artist}`.toLowerCase();
        if (!serverKeys.has(key)) {
          data.user.library.push(t);
          serverKeys.add(key);
          mergedAny = true;
        }
      });
      State.libraryTracks = data.user.library;
      State.libraryTracks.forEach(t => State.likedTracks.add(t.id));
      saveLikedTrackIds();
      saveUserLibrary(State.libraryTracks, true);
    }

    updateAuthUI();
    closeAuthModal();

    showBannerToast(`Welcome, ${data.user.username}! All songs are saved to database.`);
  } catch (err) {
    showError('Connection error. Could not contact PMusic database server.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}

async function handleLogout(callApi = true) {
  if (callApi && State.authToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${State.authToken}` }
      });
    } catch (e) {}
  }

  State.authToken = null;
  State.currentUser = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);

  updateAuthUI();
  showBannerToast('Logged out. Switched to Guest Mode.');
}

function addTrackToLibrary(track) {
  const key = `${track.name}-${track.artist}`.toLowerCase();
  const exists = State.libraryTracks.some(t => `${t.name}-${t.artist}`.toLowerCase() === key);
  if (!exists) {
    State.libraryTracks.unshift(track);
    State.likedTracks.add(track.id);
    saveLikedTrackIds();
    saveUserLibrary(State.libraryTracks);
    logUbiEvent('hitAddToLibrary', `${track.name} by ${track.artist}`);
    return true;
  }
  return false;
}

function removeTrackFromLibrary(trackId) {
  State.libraryTracks = State.libraryTracks.filter(t => t.id !== trackId);
  State.likedTracks.delete(trackId);
  saveLikedTrackIds();
  saveUserLibrary(State.libraryTracks);
  logUbiEvent('hitRemoveFromLibrary', trackId);
  updatePlayerUI();
}

function clearUserLibrary() {
  if (confirm('Are you sure you want to clear all saved songs from your library?')) {
    State.libraryTracks = [];
    State.likedTracks.clear();
    saveLikedTrackIds();
    saveUserLibrary(State.libraryTracks);
    logUbiEvent('hitClearLibrary', 'all');
  }
}

function toggleLikeTrack(trackId) {
  if (!trackId && State.currentTrack) trackId = State.currentTrack.id;
  if (!trackId) return;

  const track = (State.currentTrack && State.currentTrack.id === trackId)
    ? State.currentTrack
    : State.libraryTracks.find(t => t.id === trackId) || CURATED_TRACKS.find(t => t.id === trackId);

  if (State.likedTracks.has(trackId)) {
    State.likedTracks.delete(trackId);
    if (track) removeTrackFromLibrary(track.id);
  } else {
    State.likedTracks.add(trackId);
    if (track) addTrackToLibrary(track);
  }
  saveLikedTrackIds();
  updatePlayerUI();
}

function renderSidebarLibrary() {
  const container = document.getElementById('sidebar-library-scroll');
  const countPill = document.getElementById('library-count-pill');
  const playAllBtn = document.getElementById('btn-library-play-all');
  const clearBtn = document.getElementById('btn-library-clear-all');

  const tracks = State.libraryTracks || [];
  if (countPill) countPill.textContent = `${tracks.length} song${tracks.length === 1 ? '' : 's'}`;
  if (playAllBtn) playAllBtn.disabled = tracks.length === 0;
  if (clearBtn) clearBtn.style.display = tracks.length > 0 ? 'inline-block' : 'none';

  if (!container) return;
  container.innerHTML = '';

  if (tracks.length === 0) {
    container.innerHTML = `
      <div class="sidebar-library-empty">
        <p>Your library is empty.</p>
        <button class="sidebar-library-empty-btn" id="btn-library-empty-add">✨ Import with Chat Box</button>
      </div>
    `;
    const emptyBtn = document.getElementById('btn-library-empty-add');
    if (emptyBtn) emptyBtn.addEventListener('click', openChatModal);
    return;
  }

  tracks.forEach(track => {
    const item = document.createElement('div');
    const isCurrent = State.currentTrack && (State.currentTrack.name === track.name);
    item.className = `sidebar-library-item ${isCurrent ? 'active' : ''}`;
    item.innerHTML = `
      <img class="sidebar-library-thumb" src="${track.artwork || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100'}" alt="${escapeHtml(track.name)}" loading="lazy" decoding="async">
      <div class="sidebar-library-info">
        <div class="sidebar-library-title">${escapeHtml(track.name)}</div>
        <div class="sidebar-library-artist">${escapeHtml(track.artist)}</div>
      </div>
      <div class="sidebar-library-actions">
        <button class="sidebar-lib-btn play" title="Play Now">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <button class="sidebar-lib-btn delete" title="Remove from Library">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete')) {
        e.stopPropagation();
        removeTrackFromLibrary(track.id);
        return;
      }
      if (State.currentTrack && State.currentTrack.id === track.id) {
        togglePlayPause();
        return;
      }
      playFullTrack(track);
      State.queue = [...State.libraryTracks];
      State.queueIndex = State.queue.findIndex(t => t.id === track.id);
      renderQueueList();
    });

    container.appendChild(item);
  });
}

const SAMPLE_INPUTS = {
  numbered: `1. Starboy - The Weeknd
2. Yellow - Coldplay
3. Levitating - Dua Lipa
4. Believer - Imagine Dragons
5. Kesariya - Arijit Singh`,

  lines: `Coldplay - Viva La Vida
Queen - Bohemian Rhapsody
Ed Sheeran - Perfect
Alan Walker - Faded
Taylor Swift - Cruel Summer`,

  comma: `Blinding Lights, Birds of a Feather, Get Lucky, Starboy, Flowers - Miley Cyrus`,

  chat: `Hey, please add these favorite songs to my library:
- Night Changes by One Direction
- As It Was by Harry Styles
- Stay by Justin Bieber
- Heat Waves by Glass Animals`
};

function parseSongNamesFromText(rawText) {
  if (!rawText || !rawText.trim()) return [];

  // Remove common conversational fluff
  let text = rawText
    .replace(/^(hey|hi|hello|please|can you|could you|i want to|add|save|these songs|to my library|to the library|here are|my list of songs|thanks)[:,\s]*/gim, '')
    .replace(/(please add them|add to library|thank you|thanks).*$/gim, '');

  const lines = text.split(/\r?\n/);
  const candidates = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.includes(',') && !line.includes(' - ') && !line.includes(' by ')) {
      const parts = line.split(',');
      for (let p of parts) {
        cleanAndPush(p, candidates);
      }
    } else {
      cleanAndPush(line, candidates);
    }
  }

  return candidates;
}

function cleanAndPush(str, targetList) {
  let s = str.trim();
  s = s.replace(/^(\d+[\.\)\:]|\*|\-|•|\[\d+\])\s*/, '').trim();
  s = s.replace(/^["'“](.*)["'”]$/, '$1').trim();
  if (s.length >= 2 && !/^(song|track|artist|album|name|playlist)$/i.test(s)) {
    targetList.push(s);
  }
}

async function resolveSingleSongQuery(query) {
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        const durSec = Math.round(item.trackTimeMillis / 1000) || 180;
        return {
          id: `lib-${item.trackId || Date.now()}-${Math.random().toString(36).substring(2,6)}`,
          name: item.trackName,
          artist: item.artistName,
          album: item.collectionName || 'Single',
          albumYear: (item.releaseDate || '').substring(0, 4) || '2024',
          duration: durSec,
          durationFormatted: formatDuration(durSec),
          artwork: (item.artworkUrl100 || '').replace('100x100bb', '400x400bb'),
          previewUrl: item.previewUrl,
          youtubeId: null,
          addedAt: Date.now()
        };
      }
    }
  } catch (err) {
    console.warn('iTunes search error for query:', query, err);
  }

  // Fallback: parse query into Title and Artist
  let title = query;
  let artist = 'Various Artists';
  if (query.includes(' - ')) {
    const parts = query.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  } else if (query.toLowerCase().includes(' by ')) {
    const parts = query.split(/ by /i);
    title = parts[0].trim();
    artist = parts[1].trim();
  }

  return {
    id: `lib-custom-${Date.now()}-${Math.random().toString(36).substring(2,6)}`,
    name: title,
    artist: artist,
    album: 'Custom Track',
    albumYear: '2024',
    duration: 200,
    durationFormatted: '3:20',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
    previewUrl: null,
    youtubeId: null,
    addedAt: Date.now()
  };
}

// ==========================================================================
// FEEDBACK & EXCEL EXPORTER LOGIC
// ==========================================================================

let selectedFeedbackCategory = 'General Feedback';

function openFeedbackModal() {
  const overlay = document.getElementById('feedback-modal-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  // Pre-fill name if user is logged in
  const nameInput = document.getElementById('feedback-name-input');
  if (nameInput && !nameInput.value && State.currentUser && State.currentUser.username) {
    nameInput.value = State.currentUser.username;
  }
  setTimeout(() => {
    if (nameInput) nameInput.focus();
  }, 100);
  logUbiEvent('hitOpenFeedbackModal');
}

function closeFeedbackModal() {
  const overlay = document.getElementById('feedback-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

// Download native XML Spreadsheet 2003 or Excel file directly in the browser
function triggerClientExcelDownload(feedbackItem) {
  const escapeXml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  
  const excelXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1ED760" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Feedback">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="110"/>
   <Column ss:Width="160"/>
   <Column ss:Width="160"/>
   <Column ss:Width="140"/>
   <Column ss:Width="420"/>
   <Column ss:Width="100"/>
   <Row ss:Height="26" ss:StyleID="Header">
    <Cell><Data ss:Type="String">Feedback ID</Data></Cell>
    <Cell><Data ss:Type="String">Date &amp; Time</Data></Cell>
    <Cell><Data ss:Type="String">User Name</Data></Cell>
    <Cell><Data ss:Type="String">Category</Data></Cell>
    <Cell><Data ss:Type="String">Feedback Details</Data></Cell>
    <Cell><Data ss:Type="String">Platform</Data></Cell>
   </Row>
   <Row ss:Height="24">
    <Cell><Data ss:Type="String">${escapeXml(feedbackItem.id)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(feedbackItem.dateFormatted || feedbackItem.timestamp)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(feedbackItem.name)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(feedbackItem.category)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(feedbackItem.detail)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(feedbackItem.client || 'Web Player')}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([excelXml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (feedbackItem.name || 'User').replace(/[^a-zA-Z0-9]/g, '_');
  a.href = url;
  a.download = `PMusic_Feedback_${safeName}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function handleFeedbackSubmit(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById('feedback-name-input');
  const detailInput = document.getElementById('feedback-detail-input');
  const submitBtn = document.getElementById('btn-submit-feedback');
  const submitLabel = document.getElementById('feedback-submit-label');

  const name = nameInput ? nameInput.value.trim() : '';
  const detail = detailInput ? detailInput.value.trim() : '';

  if (!name) {
    if (nameInput) nameInput.focus();
    showBannerToast('Please enter your name.');
    return;
  }
  if (!detail) {
    if (detailInput) detailInput.focus();
    showBannerToast('Please enter your feedback details.');
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  if (submitLabel) submitLabel.textContent = 'Submitting & Generating Excel...';

  const feedbackData = {
    id: `FB-${Date.now().toString(36).toUpperCase()}`,
    name,
    detail,
    category: selectedFeedbackCategory,
    client: 'Web Player',
    timestamp: new Date().toISOString(),
    dateFormatted: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  };

  try {
    // Send to backend server
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedbackData)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.feedback) {
        feedbackData.id = data.feedback.id;
      }
    }
  } catch (err) {
    console.warn('Backend feedback recording fallback:', err);
  }

  // Trigger immediate Excel sheet download in browser
  triggerClientExcelDownload(feedbackData);

  logUbiEvent('hitSubmitFeedback', `user=${name}, cat=${selectedFeedbackCategory}`);
  showBannerToast(`Thank you, ${name}! Feedback saved & Excel sheet downloaded.`);

  // Reset detail and re-enable button
  if (detailInput) detailInput.value = '';
  if (submitBtn) submitBtn.disabled = false;
  if (submitLabel) submitLabel.textContent = 'Submit & Download Excel';

  setTimeout(() => {
    closeFeedbackModal();
  }, 600);
}

function handleExportAllFeedbackExcel() {
  logUbiEvent('hitExportAllFeedbackExcel');
  showBannerToast('Downloading complete feedback Excel report...');
  window.location.href = '/api/feedback/export.xls';
}

function openChatModal() {
  const modal = document.getElementById('chat-modal-overlay');
  if (modal) {
    modal.style.display = 'flex';
    const textarea = document.getElementById('chat-song-textarea');
    if (textarea) {
      if (!textarea.value.trim()) {
        textarea.value = SAMPLE_INPUTS.numbered;
      }
      updateChatInputCounter();
      setTimeout(() => textarea.focus(), 80);
    }
    logUbiEvent('hitOpenChatImporter', 'modal');
  }
}

function closeChatModal() {
  const modal = document.getElementById('chat-modal-overlay');
  if (modal) modal.style.display = 'none';
}

function updateChatInputCounter() {
  const textarea = document.getElementById('chat-song-textarea');
  const counter = document.getElementById('chat-input-counter');
  if (!textarea || !counter) return;

  const count = parseSongNamesFromText(textarea.value).length;
  counter.textContent = `${count} song${count === 1 ? '' : 's'} detected`;
}

async function executeChatImport() {
  const textarea = document.getElementById('chat-song-textarea');
  const rawText = textarea ? textarea.value.trim() : '';
  if (!rawText) {
    alert('Please enter or paste at least one song name.');
    return;
  }

  const queries = parseSongNamesFromText(rawText);
  if (queries.length === 0) {
    alert('No song titles could be detected. Please check the examples above.');
    return;
  }

  const submitBtn = document.getElementById('btn-chat-submit-import');
  const submitText = document.getElementById('btn-chat-submit-text');
  const resultsPanel = document.getElementById('chat-results-panel');
  const statusMessage = document.getElementById('chat-status-message');
  const spinner = document.getElementById('chat-spinner');
  const resultsList = document.getElementById('chat-results-list');
  const actionsRow = document.getElementById('chat-results-actions');

  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = 'Resolving Songs...';
  if (resultsPanel) resultsPanel.style.display = 'block';
  if (spinner) spinner.style.display = 'inline-block';
  if (actionsRow) actionsRow.style.display = 'none';
  if (resultsList) resultsList.innerHTML = '';

  const newlyAdded = [];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    if (statusMessage) {
      statusMessage.textContent = `Resolving (${i + 1}/${queries.length}): "${q}"...`;
    }

    const track = await resolveSingleSongQuery(q);
    const added = addTrackToLibrary(track);
    newlyAdded.push(track);

    if (resultsList) {
      const card = document.createElement('div');
      card.className = 'chat-result-card fade-in';
      card.innerHTML = `
        <div class="chat-result-card-left">
          <img class="chat-result-thumb" src="${track.artwork}" alt="${escapeHtml(track.name)}">
          <div>
            <div class="chat-result-title">${escapeHtml(track.name)}</div>
            <div class="chat-result-artist">${escapeHtml(track.artist)} &middot; ${track.durationFormatted}</div>
          </div>
        </div>
        <div class="chat-result-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          <span>${added ? 'Added to Library' : 'Already in Library'}</span>
        </div>
      `;
      resultsList.appendChild(card);
    }
  }

  if (spinner) spinner.style.display = 'none';
  if (statusMessage) {
    statusMessage.textContent = `🎉 Successfully processed ${queries.length} song${queries.length === 1 ? '' : 's'} and saved permanently!`;
  }
  if (actionsRow) actionsRow.style.display = 'block';
  if (submitBtn) submitBtn.disabled = false;
  if (submitText) submitText.textContent = 'Parse & Save to Library';

  const playImportedBtn = document.getElementById('btn-modal-play-imported');
  if (playImportedBtn) {
    playImportedBtn.onclick = () => {
      closeChatModal();
      playAllSongs(newlyAdded);
    };
  }

  logUbiEvent('hitBatchImportComplete', `Count: ${queries.length}`);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

if (window.YT && window.YT.Player) {
  try { window.onYouTubeIframeAPIReady(); } catch (_) {}
}

function onYtReady() {
  ytReady = true;
  console.log('YouTube Full Audio Engine Ready.');
  if (State.currentTrack && State.currentTrack.youtubeId && State.isPlaying && State.activeEngine === 'youtube') {
    try {
      ytPlayer.loadVideoById(State.currentTrack.youtubeId);
      ytPlayer.playVideo();
    } catch (_) {}
  }
}

function onYtStateChange(event) {
  // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
  if (event.data === YT.PlayerState.PLAYING) {
    State.activeEngine = 'youtube';
    const audio = document.getElementById('audio-engine');
    if (audio && !audio.paused) {
      audio.pause();
    }
    State.isPlaying = true;
    updatePlayerUI();
    startYtProgress();
  } else if (event.data === YT.PlayerState.PAUSED) {
    if (State.activeEngine === 'youtube') {
      State.isPlaying = false;
      updatePlayerUI();
      stopYtProgress();
    }
  } else if (event.data === YT.PlayerState.ENDED) {
    if (State.activeEngine === 'youtube') {
      // CONTINUOUS AUTOPLAY: Next song in queue automatically plays!
      console.log('YouTube track ended, auto-advancing to next song in queue...');
      logUbiEvent('hitTrackEnded', State.currentTrack ? State.currentTrack.name : 'track');
      playNextTrack();
    }
  }
}

function onYtError(e) {
  console.warn('YouTube Player error code:', e.data, 'Falling back to preview audio.');
  // Fallback to HTML5 audio if YouTube has embed restriction
  const audio = document.getElementById('audio-engine');
  if (audio && State.currentTrack && State.currentTrack.previewUrl) {
    State.activeEngine = 'audio';
    audio.src = State.currentTrack.previewUrl;
    audio.play().catch(err => console.warn('Preview fallback error:', err));
  } else {
    State.isPlaying = false;
    updatePlayerUI();
  }
}

let isSeekingTimeline = false;
let isSeekingVolume = false;

function getPlaybackProgress() {
  if (State.activeEngine === 'youtube' && ytPlayer && ytReady && typeof ytPlayer.getCurrentTime === 'function') {
    const cur = ytPlayer.getCurrentTime();
    const dur = ytPlayer.getDuration() || (State.currentTrack ? State.currentTrack.duration : 0) || 180;
    if (!isNaN(cur) && dur > 0) return { current: cur, duration: dur };
  }
  if (State.activeEngine === 'audio') {
    const audio = document.getElementById('audio-engine');
    if (audio && audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
      return { current: audio.currentTime, duration: audio.duration };
    }
  }
  // Generic fallback if engine wasn't explicitly tagged
  if (ytPlayer && ytReady && typeof ytPlayer.getCurrentTime === 'function') {
    const cur = ytPlayer.getCurrentTime();
    const dur = ytPlayer.getDuration() || (State.currentTrack ? State.currentTrack.duration : 0) || 180;
    if (!isNaN(cur) && dur > 0) return { current: cur, duration: dur };
  }
  const audio = document.getElementById('audio-engine');
  if (audio && audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
    return { current: audio.currentTime, duration: audio.duration };
  }
  return null;
}

// ==========================================================================
// REAL-TIME KARAOKE & SYNCHRONIZED LYRICS ENGINE
// ==========================================================================

function parseLrc(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

  lines.forEach(line => {
    const text = line.replace(timeRegex, '').trim();
    if (!text) return;
    let match;
    timeRegex.lastIndex = 0;
    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = parseInt(match[3].padEnd(3, '0').substring(0, 3), 10);
      const time = minutes * 60 + seconds + millis / 1000;
      result.push({ time, text });
    }
  });

  return result.sort((a, b) => a.time - b.time);
}

async function fetchAndDisplayLyrics(track) {
  const overlay = document.getElementById('lyrics-modal-overlay');
  const loading = document.getElementById('lyrics-loading');
  const empty = document.getElementById('lyrics-empty');
  const container = document.getElementById('lyrics-lines-container');
  const art = document.getElementById('lyrics-artwork');
  const title = document.getElementById('lyrics-song-title');
  const artist = document.getElementById('lyrics-song-artist');
  const badge = document.getElementById('lyrics-type-badge');

  if (!track) return;

  if (art) art.src = track.artwork || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=120';
  if (title) title.textContent = track.name || 'Unknown Track';
  if (artist) artist.textContent = track.artist || 'Unknown Artist';
  if (container) container.innerHTML = '';
  if (empty) empty.style.display = 'none';
  if (loading) loading.style.display = 'flex';

  State.syncedLyricList = [];
  State.activeLyricIndex = -1;
  State.currentLyrics = null;

  try {
    const qTrack = encodeURIComponent(track.name);
    const qArtist = encodeURIComponent(track.artist);
    const res = await fetch(`/api/lyrics?track=${qTrack}&artist=${qArtist}`);
    if (res.ok) {
      const data = await res.json();
      if (loading) loading.style.display = 'none';

      if (data && data.found && (data.syncedLyrics || data.plainLyrics)) {
        State.currentLyrics = data;
        const isSynced = !!data.syncedLyrics;
        if (badge) {
          badge.textContent = isSynced ? 'SYNCED' : 'PLAIN';
          badge.style.display = 'inline-block';
        }

        if (isSynced) {
          State.syncedLyricList = parseLrc(data.syncedLyrics);
          if (container) {
            State.syncedLyricList.forEach((item, index) => {
              const lineEl = document.createElement('div');
              lineEl.className = 'lyrics-line';
              lineEl.textContent = item.text;
              lineEl.dataset.time = item.time;
              lineEl.dataset.index = index;
              lineEl.addEventListener('click', () => {
                seekPlaybackToSeconds(item.time);
              });
              container.appendChild(lineEl);
            });
          }
        } else {
          const plainLines = data.plainLyrics.split('\n').filter(l => l.trim().length > 0);
          if (container) {
            plainLines.forEach((text) => {
              const lineEl = document.createElement('div');
              lineEl.className = 'lyrics-line';
              lineEl.style.color = 'rgba(255,255,255,0.7)';
              lineEl.textContent = text;
              container.appendChild(lineEl);
            });
          }
        }
        return;
      }
    }
  } catch (err) {
    console.error('Error fetching lyrics:', err);
  }

  if (loading) loading.style.display = 'none';
  if (empty) {
    empty.style.display = 'flex';
    const msg = document.getElementById('lyrics-empty-message');
    if (msg) msg.textContent = `No lyrics found for "${track.name}".`;
  }
}

function updateLyricsHighlight(currentTime) {
  if (!State.isLyricsOpen || !State.syncedLyricList || State.syncedLyricList.length === 0) return;

  let activeIndex = -1;
  for (let i = 0; i < State.syncedLyricList.length; i++) {
    if (currentTime >= State.syncedLyricList[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }

  if (activeIndex === State.activeLyricIndex) return;
  State.activeLyricIndex = activeIndex;

  const container = document.getElementById('lyrics-lines-container');
  const scrollArea = document.getElementById('lyrics-content-scroll');
  if (!container || !scrollArea) return;

  const lineEls = container.querySelectorAll('.lyrics-line');
  lineEls.forEach((el, index) => {
    if (index === activeIndex) {
      el.classList.add('active');
      el.classList.remove('passed');
      const elTop = el.offsetTop;
      const scrollHeight = scrollArea.clientHeight;
      scrollArea.scrollTo({
        top: Math.max(0, elTop - scrollHeight / 2 + el.clientHeight / 2),
        behavior: 'smooth'
      });
    } else if (index < activeIndex) {
      el.classList.remove('active');
      el.classList.add('passed');
    } else {
      el.classList.remove('active', 'passed');
    }
  });
}

function seekPlaybackToSeconds(seconds) {
  if (State.activeEngine === 'youtube' && ytPlayer && typeof ytPlayer.seekTo === 'function') {
    ytPlayer.seekTo(seconds, true);
  } else {
    const audio = document.getElementById('audio-engine');
    if (audio) audio.currentTime = seconds;
  }
}

function openLyricsModal() {
  const overlay = document.getElementById('lyrics-modal-overlay');
  const btn = document.getElementById('btn-toggle-lyrics');
  if (overlay) overlay.style.display = 'flex';
  if (btn) btn.classList.add('active-tool');
  State.isLyricsOpen = true;
  if (State.currentTrack) {
    fetchAndDisplayLyrics(State.currentTrack);
  }
}

function closeLyricsModal() {
  const overlay = document.getElementById('lyrics-modal-overlay');
  const btn = document.getElementById('btn-toggle-lyrics');
  if (overlay) overlay.style.display = 'none';
  if (btn) btn.classList.remove('active-tool');
  State.isLyricsOpen = false;
}

function toggleLyricsModal() {
  if (State.isLyricsOpen) {
    closeLyricsModal();
  } else {
    openLyricsModal();
  }
}

function toggleFullscreen() {
  const btn = document.getElementById('btn-toggle-fullscreen');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      if (btn) btn.classList.add('active-tool');
      showFloatingToast('Fullscreen Mode On (Press F or Esc)');
    }).catch(() => {});
  } else {
    document.exitFullscreen().then(() => {
      if (btn) btn.classList.remove('active-tool');
      showFloatingToast('Exited Fullscreen');
    }).catch(() => {});
  }
}

function startYtProgress() {
  stopYtProgress();
  ytProgressInterval = setInterval(() => {
    if (isSeekingTimeline) return;
    const progress = getPlaybackProgress();
    if (!progress) return;

    const { current, duration } = progress;
    const pct = Math.min(100, Math.max(0, (current / duration) * 100));

    const fill = document.getElementById('timeline-fill');
    const handle = document.getElementById('timeline-handle');
    const timeCurr = document.getElementById('player-current-time');
    const timeTotal = document.getElementById('player-total-time');

    if (fill) fill.style.width = `${pct}%`;
    if (handle) handle.style.left = `${pct}%`;
    if (timeCurr) timeCurr.textContent = formatDuration(current);
    if (timeTotal) timeTotal.textContent = formatDuration(duration);

    updateLyricsHighlight(current);
  }, 60);
}

function stopYtProgress() {
  if (ytProgressInterval) clearInterval(ytProgressInterval);
}

// Resolve full track to YouTube stream & play complete 100% full song
async function playFullTrack(track) {
  if (!track) return;
  State.currentTrack = track;
  State.isPlaying = true;
  startStreamLeaseHeartbeat();
  updatePlayerUI();
  logUbiEvent('hitPlayFullSong', `${track.name} by ${track.artist}`);

  if (State.isLyricsOpen) {
    fetchAndDisplayLyrics(track);
  }

  const audio = document.getElementById('audio-engine');

  // Helper to start YouTube full-song playback
  const startYouTube = (vId) => {
    track.youtubeId = vId;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    State.activeEngine = 'youtube';
    try {
      if (ytPlayer && ytReady && typeof ytPlayer.loadVideoById === 'function') {
        ytPlayer.loadVideoById(vId);
        ytPlayer.playVideo();
        updatePlayerUI();
        return true;
      }
    } catch (err) {
      console.warn('YouTube loadVideoById error:', err);
    }
    return false;
  };

  // 1. If we already know the video ID, play complete full song via YouTube
  let videoId = track.youtubeId;
  if (videoId) {
    if (startYouTube(videoId)) return;
  }

  // 2. If no videoId yet, resolve via server asynchronously and play FULL SONG
  try {
    const q = `${track.artist} ${track.name}`;
    const res = await fetch(`/api/resolve-full-song?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.videoId) {
        videoId = data.videoId;
        track.youtubeId = videoId;

        // Immediately start FULL SONG playback
        if (State.currentTrack && State.currentTrack.id === track.id) {
          if (startYouTube(videoId)) return;
        }
      }
    }
  } catch (e) {
    console.warn('Server full-song resolution error:', e);
  }

  // 3. Fallback to HTML5 audio preview ONLY if YouTube resolution failed completely
  if (track.previewUrl && audio) {
    if (ytPlayer && ytReady && typeof ytPlayer.pauseVideo === 'function') {
      try { ytPlayer.pauseVideo(); } catch (_) {}
    }
    State.activeEngine = 'audio';
    audio.src = track.previewUrl;
    audio.play().catch(err => {
      console.warn('HTML5 audio play blocked by browser gesture policy:', err);
    });
  } else {
    State.isPlaying = false;
    updatePlayerUI();
  }
}

function togglePlayPause() {
  if (!State.currentTrack) {
    State.currentTrack = CURATED_TRACKS[0];
  }
  const audio = document.getElementById('audio-engine');

  // If no audio engine has started yet (e.g. user clicks play button on fresh page load)
  if (State.activeEngine === 'none') {
    playFullTrack(State.currentTrack);
    return;
  }

  // If current active engine is YouTube
  if (State.activeEngine === 'youtube') {
    if (ytPlayer && ytReady && typeof ytPlayer.getPlayerState === 'function') {
      const pState = ytPlayer.getPlayerState();
      // If currently playing (1) or buffering (3)
      if (pState === 1 || pState === 3 || State.isPlaying) {
        ytPlayer.pauseVideo();
        State.isPlaying = false;
      } else {
        ytPlayer.playVideo();
        State.isPlaying = true;
      }
    } else {
      // YouTube unavailable, fallback to audio preview
      if (audio && State.currentTrack.previewUrl) {
        State.activeEngine = 'audio';
        audio.src = State.currentTrack.previewUrl;
        audio.play().then(() => {
          State.isPlaying = true;
          updatePlayerUI();
        }).catch(err => {
          console.warn('Audio play error:', err);
          State.isPlaying = false;
          updatePlayerUI();
        });
        return;
      }
    }
  } else if (State.activeEngine === 'audio') {
    // Current active engine is HTML5 audio
    if (audio) {
      if (audio.paused || !State.isPlaying) {
        if (!audio.src && State.currentTrack.previewUrl) {
          audio.src = State.currentTrack.previewUrl;
        }
        audio.play().then(() => {
          State.isPlaying = true;
          updatePlayerUI();
        }).catch(err => {
          console.warn('Audio resume blocked:', err);
          State.isPlaying = false;
          updatePlayerUI();
        });
        return;
      } else {
        audio.pause();
        State.isPlaying = false;
      }
    }
  } else {
    // Fallback: initiate track playback
    playFullTrack(State.currentTrack);
    return;
  }

  if (State.isPlaying) {
    startStreamLeaseHeartbeat();
  } else {
    stopStreamLeaseHeartbeat();
  }

  updatePlayerUI();
  logUbiEvent(State.isPlaying ? 'hitResume' : 'hitPause', State.currentTrack.name);
}

// Queue Next / Previous
function playNextTrack() {
  if (State.queue.length === 0) return;
  if (State.repeatMode === 'one' && State.currentTrack) {
    playFullTrack(State.currentTrack);
    return;
  }
  if (State.isShuffle) {
    if (State.queue.length > 1) {
      let randIndex;
      do {
        randIndex = Math.floor(Math.random() * State.queue.length);
      } while (randIndex === State.queueIndex);
      State.queueIndex = randIndex;
    }
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

// Add a track to the play queue without interrupting current song
function addToQueue(track) {
  if (!track) return;
  State.queue.push(track);
  renderQueueList();
  showFloatingToast(`Added to queue: ${track.name}`);
  logUbiEvent('hitAddToQueue', track.name);
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

  // Highlight active row in search lists and sync play/pause icon in hover overlay
  document.querySelectorAll('.track-row, .full-table-row').forEach(row => {
    const title = row.querySelector('.track-title, .table-song-title')?.textContent;
    const isCurrent = title === track.name;
    row.classList.toggle('active', isCurrent);
    const playOverlayPath = row.querySelector('.track-thumb-overlay-play svg path');
    if (playOverlayPath) {
      playOverlayPath.setAttribute('d', isCurrent && State.isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z');
    }
  });

  // Sync all floating play buttons across cards (albums, playlists, artists, songs, top result)
  document.querySelectorAll('.shelf-card, .recent-search-card, #top-result-card').forEach(card => {
    const playPath = card.querySelector('.card-floating-play-btn svg path');
    const playBtn = card.querySelector('.card-floating-play-btn');
    if (!playPath) return;

    const cardId = card.getAttribute('data-id');
    const isContextPlaying = State.isPlaying && (
      (State.currentPlayingContext && cardId && State.currentPlayingContext.id === cardId) ||
      (State.currentTrack && cardId && State.currentTrack.id === cardId)
    );

    playPath.setAttribute('d', isContextPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z');
    if (playBtn) {
      playBtn.classList.toggle('is-active', isContextPlaying);
      playBtn.title = isContextPlaying ? 'Pause' : 'Play';
    }
  });

  // Sync all detail header play buttons if visible
  document.querySelectorAll('.album-header-play-btn svg path, .artist-main-play-btn svg path, .playlist-main-play-btn svg path, .library-main-play-btn svg path').forEach(path => {
    path.setAttribute('d', State.isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z');
  });

  // Android lockscreen & notification media controls
  updateAndroidMediaSession();
}

function updateAndroidMediaSession() {
  if (!('mediaSession' in navigator) || !State.currentTrack) return;
  try {
    const track = State.currentTrack;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name || track.title || 'Unknown Title',
      artist: track.artist || 'PMusic Artist',
      album: track.album || 'PMusic - Spotify',
      artwork: [
        { src: track.artwork || track.image || '', sizes: '96x96', type: 'image/jpeg' },
        { src: track.artwork || track.image || '', sizes: '192x192', type: 'image/jpeg' },
        { src: track.artwork || track.image || '', sizes: '512x512', type: 'image/jpeg' }
      ]
    });

    navigator.mediaSession.playbackState = State.isPlaying ? 'playing' : 'paused';

    navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack());
  } catch (e) {
    // Graceful fallback if MediaSession not permitted
  }
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
      <img class="queue-item-thumb" src="${track.artwork || track.image}" alt="${track.name}" loading="lazy" decoding="async">
      <div>
        <div class="queue-item-title">${track.name}</div>
        <div class="queue-item-artist">${track.artist}</div>
      </div>
      <div style="font-size:0.75rem; color:var(--spotify-subdued);">${track.durationFormatted || '3:20'}</div>
    `;
    row.addEventListener('click', () => {
      if (State.currentTrack && State.currentTrack.id === track.id) {
        togglePlayPause();
        return;
      }
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
    if (typeof NavHistory !== 'undefined') NavHistory.push({ type: 'browse-all' });
    if (typeof setActiveNav === 'function') setActiveNav('home');
    logUbiEvent('hitUiNavigate', 'spotify:app:search:empty');
    return;
  }

  document.getElementById('filter-chips-bar').classList.add('visible');
  debounceTimer = setTimeout(() => {
    executeSearch(query);
  }, 280);
}

// High-speed client-side search cache for instantaneous (0ms) results on repeat queries and category filters
const searchCache = new Map();

async function executeSearch(query) {
  State.serpId = generateId('serp');
  State.requestId = generateId('req');
  logUbiEvent('hitSearchQuery', `query="${query}"`);

  const cacheKey = query.trim().toLowerCase();
  if (searchCache.has(cacheKey)) {
    State.currentSearchResults = searchCache.get(cacheKey);
    const cached = State.currentSearchResults;
    if (!cached.topResult && 
        (cached.tracks || []).length === 0 && 
        (cached.artists || []).length === 0 && 
        (cached.albums || []).length === 0 && 
        (cached.playlists || []).length === 0) {
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
    return;
  }

  let tracks = [];
  let artists = [];
  let albums = [];
  let playlists = [];

  if (State.useLiveSearch) {
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song,album,musicArtist&limit=100`);
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
      console.warn('Direct Apple search failed, falling back to PMusic server proxy:', err);
      try {
        const serverRes = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=50`);
        if (serverRes.ok) {
          const sData = await serverRes.json();
          if (Array.isArray(sData.tracks)) tracks.push(...sData.tracks);
          if (Array.isArray(sData.artists)) artists.push(...sData.artists);
          if (Array.isArray(sData.albums)) albums.push(...sData.albums);
        }
      } catch (sErr) {
        console.warn('Server proxy search error:', sErr);
      }
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
  } else if (playlists.length > 0 && playlists[0].title.toLowerCase() === qLower) {
    topResult = { ...playlists[0], kind: 'Playlist' };
  } else if (albums.length > 0 && albums[0].title.toLowerCase() === qLower) {
    topResult = { ...albums[0], kind: 'Album' };
  } else if (tracks.length > 0) {
    topResult = { ...tracks[0], kind: 'Song' };
  } else if (artists.length > 0) {
    topResult = { ...artists[0], kind: 'Artist' };
  } else if (albums.length > 0) {
    topResult = { ...albums[0], kind: 'Album' };
  } else if (playlists.length > 0) {
    topResult = { ...playlists[0], kind: 'Playlist' };
  }

  State.currentSearchResults = { topResult, tracks, artists, albums, playlists };
  searchCache.set(cacheKey, State.currentSearchResults);
  if (searchCache.size > 80) {
    const oldestKey = searchCache.keys().next().value;
    searchCache.delete(oldestKey);
  }

  if (!topResult && tracks.length === 0 && artists.length === 0 && albums.length === 0 && playlists.length === 0) {
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
    if (typeof NavHistory !== 'undefined') {
      NavHistory.push({ type: 'results', query: query, category: State.activeCategory });
    }
    if (typeof setActiveNav === 'function') setActiveNav('search');
  }
}

// ==========================================================================
// 5. VIEW BUILDERS & NAVIGATION HISTORY ENGINE
// ==========================================================================

const NavHistory = {
  stack: [{ type: 'browse-all' }],
  index: 0,
  isNavigating: false,
  push(entry) {
    if (this.isNavigating) return;
    const current = this.stack[this.index];
    if (current && current.type === entry.type && current.query === entry.query && current.id === entry.id) {
      return;
    }
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(entry);
    this.index = this.stack.length - 1;
    this.updateButtons();
  },
  back() {
    if (this.index > 0) {
      this.index--;
      this.isNavigating = true;
      this.restore(this.stack[this.index]);
      this.isNavigating = false;
      this.updateButtons();
    }
  },
  forward() {
    if (this.index < this.stack.length - 1) {
      this.index++;
      this.isNavigating = true;
      this.restore(this.stack[this.index]);
      this.isNavigating = false;
      this.updateButtons();
    }
  },
  updateButtons() {
    const backBtn = document.getElementById('btn-history-back');
    const fwdBtn = document.getElementById('btn-history-forward');
    if (backBtn) backBtn.disabled = this.index <= 0;
    if (fwdBtn) fwdBtn.disabled = this.index >= this.stack.length - 1;
  },
  restore(entry) {
    if (!entry) return;
    if (entry.type === 'browse-all') {
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = '';
      State.query = '';
      switchView('browse-all');
      const chips = document.getElementById('filter-chips-bar');
      if (chips) chips.classList.remove('visible');
      setActiveNav('home');
    } else if (entry.type === 'results') {
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = entry.query || '';
      State.query = entry.query || '';
      if (entry.query) executeSearch(entry.query);
      setActiveNav('search');
    } else if (entry.type === 'album') {
      showAlbumDetail(entry.data, false);
    } else if (entry.type === 'artist') {
      showArtistDetail(entry.data, false);
    } else if (entry.type === 'playlist') {
      showPlaylistDetail(entry.data, false);
    } else if (entry.type === 'library') {
      showLibraryDetail(false);
    } else if (entry.type === 'drilldown') {
      setCategoryFilter(entry.category, false);
    }
  }
};

function setActiveNav(navName) {
  const navBtnHome = document.getElementById('nav-btn-home');
  const navBtnSearch = document.getElementById('nav-btn-search');
  const navBtnPlaylists = document.getElementById('nav-btn-playlists');
  const mobileHome = document.getElementById('mobile-nav-home');
  const mobileSearch = document.getElementById('mobile-nav-search');
  const mobileLib = document.getElementById('mobile-nav-library');

  if (navBtnHome) navBtnHome.classList.toggle('active', navName === 'home');
  if (navBtnSearch) navBtnSearch.classList.toggle('active', navName === 'search');
  if (navBtnPlaylists) navBtnPlaylists.classList.toggle('active', navName === 'playlists');
  if (mobileHome) mobileHome.classList.toggle('active', navName === 'home');
  if (mobileSearch) mobileSearch.classList.toggle('active', navName === 'search');
  if (mobileLib) mobileLib.classList.toggle('active', navName === 'library');
}

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
  renderFeaturedSongs();
  renderHomePlaylists();
}

function renderHomePlaylists() {
  const grid = document.getElementById('home-playlists-grid');
  if (!grid) return;
  grid.innerHTML = '';

  CURATED_PLAYLISTS.forEach((p) => {
    const isPlayingThis = State.currentPlayingContext && State.currentPlayingContext.id === p.id && State.isPlaying;
    const card = document.createElement('div');
    card.className = 'shelf-card';
    card.setAttribute('data-id', p.id);
    card.innerHTML = `
      <div class="shelf-card-art-box">
        <img class="shelf-card-art" src="${p.artwork}" alt="${p.title}" loading="lazy">
      </div>
      <div class="shelf-card-title">${p.title}</div>
      <div class="shelf-card-desc">${p.curator}</div>
      <button class="card-floating-play-btn ${isPlayingThis ? 'is-active' : ''}" title="Play ${p.title}" aria-label="Play ${p.title}">
        <svg viewBox="0 0 24 24"><path d="${isPlayingThis ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/></svg>
      </button>
    `;

    const playBtn = card.querySelector('.card-floating-play-btn');
    if (playBtn) {
      playBtn.onclick = (e) => {
        e.stopPropagation();
        playPlaylist(p);
      };
    }

    card.onclick = () => showPlaylistDetail(p);
    grid.appendChild(card);
  });
}

function renderFeaturedSongs() {
  const container = document.getElementById('featured-songs-list');
  if (!container) return;
  container.innerHTML = '';

  CURATED_TRACKS.forEach((track) => {
    const isCurrent = State.currentTrack && State.currentTrack.id === track.id;
    const isLiked = State.likedTracks.has(track.id);
    const row = document.createElement('div');
    row.className = `track-row ${isCurrent ? 'active' : ''}`;
    row.innerHTML = `
      <div class="track-row-col-thumb">
        <img class="track-thumb-img" src="${track.artwork}" alt="${track.name}" loading="lazy" decoding="async">
        <div class="track-thumb-overlay-play">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="${isCurrent && State.isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/>
          </svg>
        </div>
      </div>
      <div class="track-row-col-main">
        <div class="track-title">${track.name}</div>
        <div class="track-subtitle">${track.artist} • ${track.album}</div>
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
      if (State.currentTrack && State.currentTrack.id === track.id) {
        togglePlayPause();
        return;
      }
      playFullTrack(track);
      addRecentItem(track);
    });

    container.appendChild(row);
  });
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

    card.setAttribute('data-id', item.id || '');
    card.innerHTML = `
      <button class="recent-dismiss-btn" title="Remove from recent searches">&times;</button>
      <div class="recent-card-image-box ${isArtist ? 'circle' : ''}">
        <img class="recent-card-image" src="${image}" alt="${title}" loading="lazy" decoding="async">
      </div>
      <div class="shelf-card-title">${title}</div>
      <div class="shelf-card-desc">${sub}</div>
      <button class="card-floating-play-btn" title="Play ${title}" aria-label="Play ${title}">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>
    `;

    card.querySelector('.recent-dismiss-btn').addEventListener('click', (e) => {
      removeRecentItem(item.id || item.name, e);
    });

    const recentPlayBtn = card.querySelector('.card-floating-play-btn');
    if (recentPlayBtn) {
      recentPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.type === 'album') {
          playAlbum(item);
        } else if (item.type === 'playlist') {
          playPlaylist(item);
        } else if (item.type === 'artist' || isArtist) {
          playArtist(item);
        } else {
          if (State.currentTrack && State.currentTrack.id === item.id) {
            togglePlayPause();
          } else {
            playFullTrack(item);
          }
        }
      });
    }

    card.addEventListener('click', () => {
      if (item.type === 'album') {
        showAlbumDetail(item);
      } else if (item.type === 'playlist') {
        showPlaylistDetail(item);
      } else if (item.type === 'artist' || isArtist) {
        showArtistDetail(item);
      } else {
        if (State.currentTrack && State.currentTrack.id === item.id) {
          togglePlayPause();
        } else {
          playFullTrack(item);
        }
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
    const isAlbum = topResult.kind === 'Album';
    const isPlaylist = topResult.kind === 'Playlist';
    const title = topResult.name || topResult.title;
    const sub = isArtist ? 'Artist' : (topResult.artist || '');
    const image = topResult.image || topResult.artwork;
    const isPlayingThis = (State.currentPlayingContext && State.currentPlayingContext.id === topResult.id && State.isPlaying) ||
                          (State.currentTrack && State.currentTrack.id === topResult.id && State.isPlaying);

    topResultCard.setAttribute('data-id', topResult.id || '');
    topResultCard.innerHTML = `
      <div class="top-result-artwork-box ${isArtist ? 'circle' : ''}">
        <img class="top-result-artwork" src="${image}" alt="${title}" loading="lazy" decoding="async">
      </div>
      <div class="top-result-title">${title}</div>
      <div class="top-result-meta-row">
        <span class="top-result-badge">${topResult.kind || 'Song'}</span>
        ${sub ? `<span class="top-result-artist-name">${sub}</span>` : ''}
      </div>
      <button class="card-floating-play-btn ${isPlayingThis ? 'is-active' : ''}" title="Play ${title}" aria-label="Play ${title}">
        <svg viewBox="0 0 24 24"><path d="${isPlayingThis ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/></svg>
      </button>
    `;

    const topPlayBtn = topResultCard.querySelector('.card-floating-play-btn');
    if (topPlayBtn) {
      topPlayBtn.onclick = (e) => {
        e.stopPropagation();
        addRecentItem(topResult);
        if (isAlbum) {
          playAlbum(topResult);
        } else if (isPlaylist) {
          playPlaylist(topResult);
        } else if (isArtist) {
          playArtist(topResult);
        } else {
          if (State.currentTrack && State.currentTrack.id === topResult.id) {
            togglePlayPause();
          } else {
            playFullTrack(topResult);
          }
        }
      };
    }

    topResultCard.onclick = () => {
      addRecentItem(topResult);
      if (isAlbum) {
        showAlbumDetail(topResult);
      } else if (isArtist) {
        showArtistDetail(topResult);
      } else if (isPlaylist) {
        showPlaylistDetail(topResult);
      } else {
        if (State.currentTrack && State.currentTrack.id === topResult.id) {
          togglePlayPause();
        } else {
          playFullTrack(topResult);
        }
      }
      logUbiEvent('hitTopResult', title);
    };
  }

  // 2. Songs Tracklist (Top songs with expand toggle to view all songs)
  const songsList = document.getElementById('top-songs-list');
  if (songsList) {
    songsList.innerHTML = '';
    const songsToRender = State.overviewShowAllSongs ? tracks : tracks.slice(0, 6);
    songsToRender.forEach((track) => {
      const isCurrent = State.currentTrack && State.currentTrack.id === track.id;
      const isLiked = State.likedTracks.has(track.id);
      const row = document.createElement('div');
      row.className = `track-row ${isCurrent ? 'active' : ''}`;
      row.innerHTML = `
        <div class="track-row-col-thumb">
          <img class="track-thumb-img" src="${track.artwork}" alt="${track.name}" loading="lazy" decoding="async">
          <div class="track-thumb-overlay-play">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="${isCurrent && State.isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/>
            </svg>
          </div>
        </div>
        <div class="track-row-col-main">
          <div class="track-title">${track.name}</div>
          <div class="track-subtitle">
            <span class="clickable-artist-link">${track.artist}</span> • <span class="clickable-album-link">${track.album}</span>
          </div>
        </div>
        <div class="track-row-col-end">
          <button class="track-queue-btn" title="Add to Queue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
            </svg>
          </button>
          <button class="track-heart-btn ${isLiked ? 'liked' : ''}" title="Save to Your Library">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </button>
          <span class="track-duration-text">${track.durationFormatted}</span>
        </div>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.track-queue-btn')) {
          e.stopPropagation();
          addToQueue(track);
          return;
        }
        if (e.target.closest('.clickable-artist-link')) {
          e.stopPropagation();
          showArtistDetail({ name: track.artist });
          return;
        }
        if (e.target.closest('.clickable-album-link')) {
          e.stopPropagation();
          showAlbumDetail({ title: track.album, artist: track.artist, artwork: track.artwork });
          return;
        }
        if (e.target.closest('.track-heart-btn')) {
          toggleLikeTrack(track.id);
          return;
        }
        if (State.currentTrack && State.currentTrack.id === track.id) {
          togglePlayPause();
          return;
        }
        playFullTrack(track);
        addRecentItem(track);
      });

      songsList.appendChild(row);
    });

    if (tracks.length > 6) {
      const toggleRow = document.createElement('div');
      toggleRow.className = 'songs-expand-row';
      toggleRow.style.cssText = 'padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 6px;';
      toggleRow.innerHTML = `
        <button class="songs-toggle-all-btn" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: var(--spotify-white); font-size: 0.82rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 500px; transition: background 0.2s ease;">
          <span>${State.overviewShowAllSongs ? 'Show Top 6 Only' : `Show All ${tracks.length} Songs`}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="transform: ${State.overviewShowAllSongs ? 'rotate(180deg)' : 'rotate(0)'}; transition: transform 0.2s ease;">
            <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </button>
        <button class="songs-view-drilldown-btn" style="background: none; border: none; color: var(--spotify-green); font-size: 0.82rem; font-weight: 700; cursor: pointer; padding: 4px 8px;">
          View Full Table &rarr;
        </button>
      `;
      toggleRow.querySelector('.songs-toggle-all-btn').onclick = (e) => {
        e.stopPropagation();
        State.overviewShowAllSongs = !State.overviewShowAllSongs;
        renderOverviewResults();
      };
      toggleRow.querySelector('.songs-view-drilldown-btn').onclick = (e) => {
        e.stopPropagation();
        setCategoryFilter('tracks');
      };
      songsList.appendChild(toggleRow);
    }
  }

  // 3. Shelves
  renderShelf('shelf-artists-section', 'shelf-artists-grid', artists, true, (a) => {
    addRecentItem(a);
    showArtistDetail(a);
  });

  renderShelf('shelf-albums-section', 'shelf-albums-grid', albums, false, (al) => {
    showAlbumDetail(al);
  });

  renderShelf('shelf-playlists-section', 'shelf-playlists-grid', playlists, false, (p) => {
    showPlaylistDetail(p);
  });
}

function showFloatingToast(message) {
  let toast = document.getElementById('pmusic-floating-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pmusic-floating-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #1ed760;
      color: #000;
      font-weight: 700;
      font-size: 0.9rem;
      padding: 10px 24px;
      border-radius: 500px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      z-index: 9999;
      opacity: 0;
      pointer-events: none;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._hideTimeout);
  toast._hideTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2400);
}

function playAllSongs(trackList, startIndex = 0) {
  const list = trackList && trackList.length > 0 ? trackList : CURATED_TRACKS;
  if (!list || list.length === 0) return;
  State.currentPlayingContext = { type: 'queue', id: 'all_songs', title: 'All Songs' };
  State.queue = [...list];
  State.queueIndex = Math.max(0, Math.min(startIndex, list.length - 1));
  renderQueueList();
  playFullTrack(list[State.queueIndex]);
  addRecentItem(list[State.queueIndex]);
  showFloatingToast(`Playing all ${list.length} songs`);
  updatePlayerUI();
}

async function getAlbumTracks(album) {
  if (!album) return [];
  if (album.tracks && album.tracks.length > 0) return album.tracks;

  // 1. Check if matching tracks exist in current search results
  if (State.currentSearchResults && State.currentSearchResults.tracks && State.currentSearchResults.tracks.length > 0) {
    const matching = State.currentSearchResults.tracks.filter(t => 
      t.album && (
        t.album.toLowerCase() === album.title.toLowerCase() ||
        album.title.toLowerCase().includes(t.album.toLowerCase())
      )
    );
    if (matching.length > 0) {
      album.tracks = matching;
      return matching;
    }
  }

  // 2. Extract numeric collection ID if from iTunes collection
  const colId = (album.id || '').replace(/^album-/, '').trim();
  if (/^\d+$/.test(colId)) {
    try {
      const res = await fetch(`https://itunes.apple.com/lookup?id=${colId}&entity=song`);
      if (res.ok) {
        const data = await res.json();
        const rawTracks = (data.results || []).filter(r => r.wrapperType === 'track');
        if (rawTracks.length > 0) {
          const parsed = rawTracks.map(item => ({
            id: `track-${item.trackId}`,
            name: item.trackName,
            artist: item.artistName,
            album: item.collectionName || album.title,
            albumYear: (item.releaseDate || '').substring(0, 4) || album.year,
            duration: Math.round(item.trackTimeMillis / 1000) || 180,
            durationFormatted: formatDuration(Math.round(item.trackTimeMillis / 1000) || 180),
            artwork: (item.artworkUrl100 || album.artwork || '').replace('100x100bb', '400x400bb'),
            previewUrl: item.previewUrl,
            youtubeId: null,
            type: 'track'
          }));
          album.tracks = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Album lookup failed:', e);
    }
  }

  // 3. Fallback: Search iTunes songs by album title + artist
  try {
    const q = `${album.title} ${album.artist || ''}`.trim();
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=25`);
    if (res.ok) {
      const data = await res.json();
      const rawTracks = (data.results || []).filter(r => r.wrapperType === 'track');
      if (rawTracks.length > 0) {
        const parsed = rawTracks.map(item => ({
          id: `track-${item.trackId}`,
          name: item.trackName,
          artist: item.artistName,
          album: item.collectionName || album.title,
          albumYear: (item.releaseDate || '').substring(0, 4) || album.year,
          duration: Math.round(item.trackTimeMillis / 1000) || 180,
          durationFormatted: formatDuration(Math.round(item.trackTimeMillis / 1000) || 180),
          artwork: (item.artworkUrl100 || album.artwork || '').replace('100x100bb', '400x400bb'),
          previewUrl: item.previewUrl,
          youtubeId: null,
          type: 'track'
        }));
        album.tracks = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Album search failed:', e);
  }

  // 4. Fallback from curated catalog if matches title
  const curatedMatches = CURATED_TRACKS.filter(t => 
    t.album.toLowerCase().includes(album.title.toLowerCase()) || 
    album.title.toLowerCase().includes(t.album.toLowerCase())
  );
  if (curatedMatches.length > 0) {
    album.tracks = curatedMatches;
    return curatedMatches;
  }

  // 5. Single track fallback representing album title
  const fallback = [{
    id: `track-${album.id}`,
    name: album.title,
    artist: album.artist || 'Artist',
    album: album.title,
    albumYear: album.year || '2025',
    duration: 210,
    durationFormatted: '3:30',
    artwork: album.artwork || album.image,
    previewUrl: null,
    youtubeId: null,
    type: 'track'
  }];
  album.tracks = fallback;
  return fallback;
}

async function getPlaylistTracks(playlist) {
  if (!playlist) return [];
  if (playlist.tracks && playlist.tracks.length > 0) return playlist.tracks;
  if (Array.isArray(playlist.trackIds) && playlist.trackIds.length > 0) {
    const matched = CURATED_TRACKS.filter(t => playlist.trackIds.includes(t.id));
    if (matched.length > 0) return matched;
  }
  if (State.currentSearchResults && State.currentSearchResults.tracks && State.currentSearchResults.tracks.length > 0) {
    return State.currentSearchResults.tracks;
  }
  return CURATED_TRACKS;
}

async function getArtistTracks(artist) {
  if (!artist) return [];
  if (artist.tracks && artist.tracks.length > 0) return artist.tracks;

  if (State.currentSearchResults && State.currentSearchResults.tracks) {
    const matching = State.currentSearchResults.tracks.filter(t => 
      t.artist.toLowerCase().includes(artist.name.toLowerCase()) || 
      artist.name.toLowerCase().includes(t.artist.toLowerCase())
    );
    if (matching.length > 0) return matching;
  }

  const artistId = (artist.id || '').replace(/^artist-/, '').trim();
  if (/^\d+$/.test(artistId)) {
    try {
      const res = await fetch(`https://itunes.apple.com/lookup?id=${artistId}&entity=song&limit=25`);
      if (res.ok) {
        const data = await res.json();
        const rawTracks = (data.results || []).filter(r => r.wrapperType === 'track');
        if (rawTracks.length > 0) {
          const parsed = rawTracks.map(item => ({
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
          }));
          artist.tracks = parsed;
          return parsed;
        }
      }
    } catch (_) {}
  }

  const curatedMatches = CURATED_TRACKS.filter(t => t.artist.toLowerCase().includes(artist.name.toLowerCase()));
  if (curatedMatches.length > 0) return curatedMatches;
  return CURATED_TRACKS;
}

async function playAlbum(album) {
  if (!album) return;
  if (State.currentPlayingContext && State.currentPlayingContext.id === album.id) {
    togglePlayPause();
    return;
  }
  showFloatingToast(`Playing album: ${album.title}`);
  logUbiEvent('hitPlayAlbum', album.title);
  const tracks = await getAlbumTracks(album);
  if (tracks && tracks.length > 0) {
    State.currentPlayingContext = { type: 'album', id: album.id, title: album.title };
    State.queue = [...tracks];
    State.queueIndex = 0;
    renderQueueList();
    playFullTrack(tracks[0]);
    addRecentItem(tracks[0]);
    updatePlayerUI();
  }
}

async function playPlaylist(playlist) {
  if (!playlist) return;
  if (State.currentPlayingContext && State.currentPlayingContext.id === playlist.id) {
    togglePlayPause();
    return;
  }
  showFloatingToast(`Playing playlist: ${playlist.title}`);
  logUbiEvent('hitPlayPlaylist', playlist.title);
  const tracks = await getPlaylistTracks(playlist);
  if (tracks && tracks.length > 0) {
    State.currentPlayingContext = { type: 'playlist', id: playlist.id, title: playlist.title };
    State.queue = [...tracks];
    State.queueIndex = 0;
    renderQueueList();
    playFullTrack(tracks[0]);
    addRecentItem(tracks[0]);
    updatePlayerUI();
  }
}

async function playAllPlaylists() {
  const allTracks = [];
  const seenIds = new Set();
  for (const p of CURATED_PLAYLISTS) {
    const pTracks = await getPlaylistTracks(p);
    pTracks.forEach(t => {
      if (!seenIds.has(t.id)) {
        seenIds.add(t.id);
        allTracks.push(t);
      }
    });
  }
  if (allTracks.length > 0) {
    showFloatingToast(`Playing All Playlists (${allTracks.length} Songs)`);
    logUbiEvent('hitPlayAllPlaylists', `${allTracks.length} tracks`);
    State.currentPlayingContext = { type: 'playlist', id: 'all-playlists', title: 'All Spotify Playlists' };
    State.queue = [...allTracks];
    State.queueIndex = 0;
    renderQueueList();
    playFullTrack(allTracks[0]);
    addRecentItem(allTracks[0]);
    updatePlayerUI();
  }
}

async function playArtist(artist) {
  if (!artist) return;
  if (State.currentPlayingContext && State.currentPlayingContext.id === artist.id) {
    togglePlayPause();
    return;
  }
  showFloatingToast(`Playing artist: ${artist.name}`);
  logUbiEvent('hitPlayArtist', artist.name);
  const tracks = await getArtistTracks(artist);
  if (tracks && tracks.length > 0) {
    State.currentPlayingContext = { type: 'artist', id: artist.id, title: artist.name };
    State.queue = [...tracks];
    State.queueIndex = 0;
    renderQueueList();
    playFullTrack(tracks[0]);
    addRecentItem(tracks[0]);
    updatePlayerUI();
  }
}

async function showAlbumDetail(album, pushHistory = true) {
  if (!album) return;
  if (pushHistory && typeof NavHistory !== 'undefined') {
    NavHistory.push({ type: 'album', data: album });
  }

  addRecentItem(album);
  logUbiEvent('hitAlbumDetail', album.title);

  const container = document.getElementById('drilldown-content-container');
  const titleElem = document.getElementById('drilldown-title');
  if (!container || !titleElem) return;

  titleElem.textContent = album.title;
  container.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; padding: 40px;">
      <div class="loader-spinner" style="width:36px; height:36px; border:3px solid rgba(255,255,255,0.15); border-top-color:var(--spotify-green); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
    </div>
  `;
  switchView('drilldown');

  const tracks = await getAlbumTracks(album);
  const isPlayingThis = State.currentPlayingContext && State.currentPlayingContext.id === album.id && State.isPlaying;

  container.innerHTML = `
    <div class="album-detail-header" style="display:flex; gap:24px; align-items:flex-end; padding:24px 0 32px 0; border-bottom:1px solid rgba(255,255,255,0.08); margin-bottom:24px; flex-wrap:wrap;">
      <img src="${album.artwork || album.image}" alt="${album.title}" style="width:200px; height:200px; border-radius:8px; object-fit:cover; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
      <div style="display:flex; flex-direction:column; gap:8px;">
        <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--spotify-subdued);">Album</span>
        <h1 style="font-size:clamp(1.8rem, 4vw, 2.6rem); font-weight:800; line-height:1.1; margin:0; color:var(--spotify-white);">${album.title}</h1>
        <div style="font-size:0.9rem; color:var(--spotify-subdued); display:flex; align-items:center; gap:8px; margin-top:4px;">
          <span style="font-weight:700; color:var(--spotify-white);" class="clickable-artist-link" id="album-artist-link">${album.artist}</span>
          <span>•</span>
          <span>${album.year || '2025'}</span>
          <span>•</span>
          <span>${tracks.length} songs</span>
        </div>
        <div style="display:flex; align-items:center; gap:16px; margin-top:16px;">
          <button class="album-header-play-btn" style="width:56px; height:56px; border-radius:50%; background:var(--spotify-green); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 8px 16px rgba(0,0,0,0.3); transition: transform 0.2s, background 0.2s;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#000">
              <path d="${isPlayingThis ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/>
            </svg>
          </button>
          <button class="album-back-btn" id="btn-album-back" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:var(--spotify-white); padding:8px 18px; border-radius:20px; font-size:0.85rem; font-weight:600; cursor:pointer;">
            &larr; Back
          </button>
        </div>
      </div>
    </div>
    <table class="full-tracklist-table">
      <thead>
        <tr>
          <th style="width:40px; text-align:center;">#</th>
          <th>Title</th>
          <th>Artist</th>
          <th style="width:50px; text-align:center;">Queue</th>
          <th style="width:80px; text-align:right;">Duration</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  const headerPlayBtn = container.querySelector('.album-header-play-btn');
  if (headerPlayBtn) {
    headerPlayBtn.onclick = () => playAlbum(album);
  }

  const backBtn = container.querySelector('#btn-album-back');
  if (backBtn) {
    backBtn.onclick = () => NavHistory.back();
  }

  const artistLink = container.querySelector('#album-artist-link');
  if (artistLink) {
    artistLink.onclick = () => showArtistDetail({ name: album.artist });
  }

  const tbody = container.querySelector('tbody');
  tracks.forEach((track, index) => {
    const isCurrent = State.currentTrack && State.currentTrack.id === track.id;
    const row = document.createElement('tr');
    row.className = `full-table-row ${isCurrent ? 'active' : ''}`;
    row.innerHTML = `
      <td style="text-align:center; color:var(--spotify-subdued);">${index + 1}</td>
      <td>
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="${track.artwork || album.artwork}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;" loading="lazy">
          <div>
            <div class="table-song-title" style="font-weight:600; color:${isCurrent ? 'var(--spotify-green)' : 'var(--spotify-white)'};">${track.name}</div>
            <div style="font-size:0.8rem; color:var(--spotify-subdued);" class="clickable-artist-link">${track.artist}</div>
          </div>
        </div>
      </td>
      <td style="color:var(--spotify-subdued);">
        <span class="clickable-artist-link">${track.artist}</span>
      </td>
      <td style="text-align:center;">
        <button class="track-queue-btn" title="Add to Queue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
          </svg>
        </button>
      </td>
      <td style="text-align:right; color:var(--spotify-subdued); font-variant-numeric:tabular-nums;">${track.durationFormatted || '3:20'}</td>
    `;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.track-queue-btn')) {
        e.stopPropagation();
        addToQueue(track);
        return;
      }
      if (e.target.closest('.clickable-artist-link')) {
        e.stopPropagation();
        showArtistDetail({ name: track.artist });
        return;
      }
      if (State.currentTrack && State.currentTrack.id === track.id) {
        togglePlayPause();
        return;
      }
      State.currentPlayingContext = { type: 'album', id: album.id, title: album.title };
      State.queue = [...tracks];
      State.queueIndex = index;
      renderQueueList();
      playFullTrack(track);
      addRecentItem(track);
    });

    tbody.appendChild(row);
  });
}

async function showArtistDetail(artist, pushHistory = true) {
  if (!artist) return;
  const artistName = typeof artist === 'string' ? artist : (artist.name || artist.title || 'Artist');
  const artistObj = typeof artist === 'object' ? artist : { id: `artist-${artistName.toLowerCase().replace(/\s+/g, '-')}`, name: artistName };

  if (pushHistory && typeof NavHistory !== 'undefined') {
    NavHistory.push({ type: 'artist', data: artistObj });
  }

  addRecentItem(artistObj);
  logUbiEvent('hitArtistDetail', artistName);

  const container = document.getElementById('drilldown-content-container');
  const titleElem = document.getElementById('drilldown-title');
  if (!container || !titleElem) return;

  titleElem.textContent = artistName;
  container.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; padding: 60px 0;">
      <div class="loader-spinner" style="width:38px; height:38px; border:3px solid rgba(255,255,255,0.15); border-top-color:var(--spotify-green); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
    </div>
  `;
  switchView('drilldown');

  const tracks = await getArtistTracks(artistObj);
  const isPlayingThis = State.currentPlayingContext && State.currentPlayingContext.id === artistObj.id && State.isPlaying;
  const isFollowing = State.followingArtists.has(artistName);

  const artistImg = artistObj.image || (tracks[0] ? tracks[0].artwork : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80');

  const artistAlbums = (State.currentSearchResults?.albums || []).filter(al => 
    al.artist && al.artist.toLowerCase().includes(artistName.toLowerCase())
  );
  if (artistAlbums.length === 0 && typeof CURATED_ALBUMS !== 'undefined') {
    const cur = CURATED_ALBUMS.filter(al => al.artist && al.artist.toLowerCase().includes(artistName.toLowerCase()));
    if (cur.length > 0) artistAlbums.push(...cur);
  }

  container.innerHTML = `
    <div class="artist-detail-header">
      <img class="artist-avatar-img" src="${artistImg}" alt="${artistName}">
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div class="artist-verified-row">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span>Verified Artist</span>
        </div>
        <h1 class="artist-title-text">${artistName}</h1>
        <div class="artist-listeners-text">
          <span>74,831,020 monthly listeners</span>
        </div>
        <div class="artist-action-bar">
          <button class="album-header-play-btn artist-main-play-btn" style="width:56px; height:56px; border-radius:50%; background:var(--spotify-green); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 8px 16px rgba(0,0,0,0.3); transition: transform 0.2s, background 0.2s;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#000">
              <path d="${isPlayingThis ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/>
            </svg>
          </button>
          <button class="artist-follow-btn ${isFollowing ? 'following' : ''}" id="btn-artist-follow">
            ${isFollowing ? 'Following' : 'Follow'}
          </button>
          <button class="album-back-btn" id="btn-artist-back" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:var(--spotify-white); padding:8px 18px; border-radius:20px; font-size:0.85rem; font-weight:600; cursor:pointer;">
            &larr; Back
          </button>
        </div>
      </div>
    </div>

    <h2 class="detail-section-title">Popular</h2>
    <table class="full-tracklist-table" style="margin-bottom: 32px;">
      <thead>
        <tr>
          <th style="width:40px; text-align:center;">#</th>
          <th>Title</th>
          <th>Album</th>
          <th style="width:50px; text-align:center;">Queue</th>
          <th style="width:80px; text-align:right;">Duration</th>
        </tr>
      </thead>
      <tbody id="artist-popular-tbody"></tbody>
    </table>

    ${artistAlbums.length > 0 ? `
      <h2 class="detail-section-title">Discography</h2>
      <div class="shelf-cards-grid" id="artist-albums-grid"></div>
    ` : ''}
  `;

  const playBtn = container.querySelector('.artist-main-play-btn');
  if (playBtn) playBtn.onclick = () => playArtist(artistObj);

  const followBtn = container.querySelector('#btn-artist-follow');
  if (followBtn) {
    followBtn.onclick = () => {
      if (State.followingArtists.has(artistName)) {
        State.followingArtists.delete(artistName);
        followBtn.classList.remove('following');
        followBtn.textContent = 'Follow';
        showFloatingToast(`Unfollowed ${artistName}`);
      } else {
        State.followingArtists.add(artistName);
        followBtn.classList.add('following');
        followBtn.textContent = 'Following';
        showFloatingToast(`Following ${artistName}`);
      }
    };
  }

  const backBtn = container.querySelector('#btn-artist-back');
  if (backBtn) backBtn.onclick = () => NavHistory.back();

  const tbody = container.querySelector('#artist-popular-tbody');
  tracks.slice(0, 10).forEach((track, index) => {
    const isCurrent = State.currentTrack && State.currentTrack.id === track.id;
    const row = document.createElement('tr');
    row.className = `full-table-row ${isCurrent ? 'active' : ''}`;
    row.innerHTML = `
      <td style="text-align:center; color:var(--spotify-subdued);">${index + 1}</td>
      <td>
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="${track.artwork}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;" loading="lazy">
          <div>
            <div class="table-song-title" style="font-weight:600; color:${isCurrent ? 'var(--spotify-green)' : 'var(--spotify-white)'};">${track.name}</div>
            <div style="font-size:0.8rem; color:var(--spotify-subdued);">${track.artist}</div>
          </div>
        </div>
      </td>
      <td style="color:var(--spotify-subdued);">
        <span class="clickable-album-link">${track.album || 'Single'}</span>
      </td>
      <td style="text-align:center;">
        <button class="track-queue-btn" title="Add to Queue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
          </svg>
        </button>
      </td>
      <td style="text-align:right; color:var(--spotify-subdued); font-variant-numeric:tabular-nums;">${track.durationFormatted || '3:20'}</td>
    `;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.track-queue-btn')) {
        e.stopPropagation();
        addToQueue(track);
        return;
      }
      if (e.target.closest('.clickable-album-link')) {
        e.stopPropagation();
        showAlbumDetail({ title: track.album, artist: track.artist, artwork: track.artwork });
        return;
      }
      if (State.currentTrack && State.currentTrack.id === track.id) {
        togglePlayPause();
        return;
      }
      State.currentPlayingContext = { type: 'artist', id: artistObj.id, title: artistName };
      State.queue = [...tracks];
      State.queueIndex = index;
      renderQueueList();
      playFullTrack(track);
      addRecentItem(track);
    });

    tbody.appendChild(row);
  });

  const albumsGrid = container.querySelector('#artist-albums-grid');
  if (albumsGrid && artistAlbums.length > 0) {
    artistAlbums.forEach(al => {
      const isPlayingAl = State.currentPlayingContext && State.currentPlayingContext.id === al.id && State.isPlaying;
      const card = document.createElement('div');
      card.className = 'shelf-card';
      card.setAttribute('data-id', al.id);
      card.innerHTML = `
        <div class="shelf-card-art-box">
          <img class="shelf-card-art" src="${al.artwork || al.image}" alt="${al.title}" loading="lazy">
        </div>
        <div class="shelf-card-title">${al.title}</div>
        <div class="shelf-card-desc">${al.year || ''} • Album</div>
        <button class="card-floating-play-btn ${isPlayingAl ? 'is-active' : ''}" title="Play ${al.title}">
          <svg viewBox="0 0 24 24"><path d="${isPlayingAl ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/></svg>
        </button>
      `;
      const pBtn = card.querySelector('.card-floating-play-btn');
      if (pBtn) {
        pBtn.onclick = (e) => {
          e.stopPropagation();
          playAlbum(al);
        };
      }
      card.onclick = () => showAlbumDetail(al);
      albumsGrid.appendChild(card);
    });
  }
}

async function showPlaylistDetail(playlist, pushHistory = true) {
  if (!playlist) return;
  if (pushHistory && typeof NavHistory !== 'undefined') {
    NavHistory.push({ type: 'playlist', data: playlist });
  }

  addRecentItem(playlist);
  logUbiEvent('hitPlaylistDetail', playlist.title);

  const container = document.getElementById('drilldown-content-container');
  const titleElem = document.getElementById('drilldown-title');
  if (!container || !titleElem) return;

  titleElem.textContent = playlist.title;
  container.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; padding: 60px 0;">
      <div class="loader-spinner" style="width:38px; height:38px; border:3px solid rgba(255,255,255,0.15); border-top-color:var(--spotify-green); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
    </div>
  `;
  switchView('drilldown');

  const tracks = await getPlaylistTracks(playlist);
  const isPlayingThis = State.currentPlayingContext && State.currentPlayingContext.id === playlist.id && State.isPlaying;

  container.innerHTML = `
    <div class="playlist-detail-header">
      <img class="playlist-cover-img" src="${playlist.artwork || playlist.image}" alt="${playlist.title}">
      <div style="display:flex; flex-direction:column; gap:6px;">
        <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--spotify-subdued);">Public Playlist</span>
        <h1 style="font-size:clamp(1.8rem, 4vw, 2.6rem); font-weight:800; line-height:1.1; margin:0; color:var(--spotify-white);">${playlist.title}</h1>
        <div style="font-size:0.9rem; color:var(--spotify-subdued); display:flex; align-items:center; gap:8px; margin-top:4px;">
          <span style="font-weight:700; color:var(--spotify-white);">${playlist.curator || 'Spotify'}</span>
          <span>•</span>
          <span>${tracks.length} songs</span>
        </div>
        <div style="display:flex; align-items:center; gap:16px; margin-top:16px;">
          <button class="album-header-play-btn playlist-main-play-btn" style="width:56px; height:56px; border-radius:50%; background:var(--spotify-green); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 8px 16px rgba(0,0,0,0.3); transition: transform 0.2s, background 0.2s;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#000">
              <path d="${isPlayingThis ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/>
            </svg>
          </button>
          <button class="album-back-btn" id="btn-playlist-back" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:var(--spotify-white); padding:8px 18px; border-radius:20px; font-size:0.85rem; font-weight:600; cursor:pointer;">
            &larr; Back
          </button>
        </div>
      </div>
    </div>

    <table class="full-tracklist-table">
      <thead>
        <tr>
          <th style="width:40px; text-align:center;">#</th>
          <th>Title</th>
          <th>Album</th>
          <th style="width:50px; text-align:center;">Queue</th>
          <th style="width:80px; text-align:right;">Duration</th>
        </tr>
      </thead>
      <tbody id="playlist-tracks-tbody"></tbody>
    </table>
  `;

  const playBtn = container.querySelector('.playlist-main-play-btn');
  if (playBtn) playBtn.onclick = () => playPlaylist(playlist);

  const backBtn = container.querySelector('#btn-playlist-back');
  if (backBtn) backBtn.onclick = () => NavHistory.back();

  const tbody = container.querySelector('#playlist-tracks-tbody');
  tracks.forEach((track, index) => {
    const isCurrent = State.currentTrack && State.currentTrack.id === track.id;
    const row = document.createElement('tr');
    row.className = `full-table-row ${isCurrent ? 'active' : ''}`;
    row.innerHTML = `
      <td style="text-align:center; color:var(--spotify-subdued);">${index + 1}</td>
      <td>
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="${track.artwork}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;" loading="lazy">
          <div>
            <div class="table-song-title" style="font-weight:600; color:${isCurrent ? 'var(--spotify-green)' : 'var(--spotify-white)'};">${track.name}</div>
            <div style="font-size:0.8rem; color:var(--spotify-subdued);" class="clickable-artist-link">${track.artist}</div>
          </div>
        </div>
      </td>
      <td style="color:var(--spotify-subdued);">
        <span class="clickable-album-link">${track.album || 'Single'}</span>
      </td>
      <td style="text-align:center;">
        <button class="track-queue-btn" title="Add to Queue">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
          </svg>
        </button>
      </td>
      <td style="text-align:right; color:var(--spotify-subdued); font-variant-numeric:tabular-nums;">${track.durationFormatted || '3:20'}</td>
    `;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.track-queue-btn')) {
        e.stopPropagation();
        addToQueue(track);
        return;
      }
      if (e.target.closest('.clickable-artist-link')) {
        e.stopPropagation();
        showArtistDetail({ name: track.artist });
        return;
      }
      if (e.target.closest('.clickable-album-link')) {
        e.stopPropagation();
        showAlbumDetail({ title: track.album, artist: track.artist, artwork: track.artwork });
        return;
      }
      if (State.currentTrack && State.currentTrack.id === track.id) {
        togglePlayPause();
        return;
      }
      State.currentPlayingContext = { type: 'playlist', id: playlist.id, title: playlist.title };
      State.queue = [...tracks];
      State.queueIndex = index;
      renderQueueList();
      playFullTrack(track);
      addRecentItem(track);
    });

    tbody.appendChild(row);
  });
}

function showLibraryDetail(pushHistory = true) {
  if (pushHistory && typeof NavHistory !== 'undefined') {
    NavHistory.push({ type: 'library' });
  }

  logUbiEvent('hitLibraryDetail', `tracks=${State.libraryTracks.length}`);

  const container = document.getElementById('drilldown-content-container');
  const titleElem = document.getElementById('drilldown-title');
  if (!container || !titleElem) return;

  const isPlayingThis = State.currentPlayingContext && State.currentPlayingContext.id === 'user_library' && State.isPlaying;
  const userName = State.currentUser ? State.currentUser.username : 'User';

  titleElem.textContent = 'Liked Songs';
  switchView('drilldown');

  container.innerHTML = `
    <div class="library-hero-gradient">
      <div class="library-heart-artwork">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="#ffffff">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:rgba(255,255,255,0.8);">Playlist</span>
        <h1 style="font-size:clamp(2rem, 5vw, 3.2rem); font-weight:900; line-height:1.05; margin:0; color:#fff;">Liked Songs</h1>
        <div style="font-size:0.9rem; color:rgba(255,255,255,0.85); display:flex; align-items:center; gap:8px; margin-top:4px;">
          <span style="font-weight:700; color:#fff;">${userName}</span>
          <span>•</span>
          <span>${State.libraryTracks.length} saved songs</span>
        </div>
        <div style="display:flex; align-items:center; gap:16px; margin-top:16px;">
          <button class="album-header-play-btn library-main-play-btn" style="width:56px; height:56px; border-radius:50%; background:var(--spotify-green); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 8px 16px rgba(0,0,0,0.3); transition: transform 0.2s, background 0.2s;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#000">
              <path d="${isPlayingThis ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/>
            </svg>
          </button>
          <button class="chat-action-btn secondary" id="btn-lib-open-chat" style="background:rgba(255,255,255,0.15); border:none; color:#fff; padding:10px 20px; border-radius:500px; font-weight:700; font-size:0.85rem; cursor:pointer;">
            + Add Songs via Chat
          </button>
          <button class="album-back-btn" id="btn-library-back" style="background:transparent; border:1px solid rgba(255,255,255,0.3); color:#fff; padding:8px 18px; border-radius:20px; font-size:0.85rem; font-weight:600; cursor:pointer;">
            &larr; Back
          </button>
        </div>
      </div>
    </div>

    ${State.libraryTracks.length === 0 ? `
      <div style="text-align:center; padding: 48px 20px; color:var(--spotify-subdued);">
        <h3 style="color:#fff; font-size:1.2rem; margin-bottom:8px;">Your library is currently empty</h3>
        <p style="font-size:0.9rem; max-width:420px; margin:0 auto 20px auto;">Save songs using the heart icon on any song, or use our Chat Importer to paste lists of your favorite tracks!</p>
        <button class="feedback-submit-btn" id="btn-empty-lib-chat" style="margin:0 auto; padding:10px 24px;">Import Songs Now</button>
      </div>
    ` : `
      <table class="full-tracklist-table">
        <thead>
          <tr>
            <th style="width:40px; text-align:center;">#</th>
            <th>Title</th>
            <th>Album</th>
            <th style="width:40px; text-align:center;">Like</th>
            <th style="width:80px; text-align:right;">Duration</th>
          </tr>
        </thead>
        <tbody id="library-tracks-tbody"></tbody>
      </table>
    `}
  `;

  const playBtn = container.querySelector('.library-main-play-btn');
  if (playBtn) {
    playBtn.onclick = () => {
      if (State.libraryTracks.length > 0) {
        State.currentPlayingContext = { type: 'library', id: 'user_library', title: 'Liked Songs' };
        playAllSongs(State.libraryTracks);
      } else {
        playAllSongs(CURATED_TRACKS);
      }
    };
  }

  const chatBtn = container.querySelector('#btn-lib-open-chat');
  if (chatBtn) chatBtn.onclick = openChatModal;

  const emptyChatBtn = container.querySelector('#btn-empty-lib-chat');
  if (emptyChatBtn) emptyChatBtn.onclick = openChatModal;

  const backBtn = container.querySelector('#btn-library-back');
  if (backBtn) backBtn.onclick = () => NavHistory.back();

  const tbody = container.querySelector('#library-tracks-tbody');
  if (tbody) {
    State.libraryTracks.forEach((track, index) => {
      const isCurrent = State.currentTrack && State.currentTrack.id === track.id;
      const row = document.createElement('tr');
      row.className = `full-table-row ${isCurrent ? 'active' : ''}`;
      row.innerHTML = `
        <td style="text-align:center; color:var(--spotify-subdued);">${index + 1}</td>
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${track.artwork || ''}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;" loading="lazy">
            <div>
              <div class="table-song-title" style="font-weight:600; color:${isCurrent ? 'var(--spotify-green)' : 'var(--spotify-white)'};">${track.name}</div>
              <div style="font-size:0.8rem; color:var(--spotify-subdued);" class="clickable-artist-link">${track.artist}</div>
            </div>
          </div>
        </td>
        <td style="color:var(--spotify-subdued);">
          <span class="clickable-album-link">${track.album || 'Single'}</span>
        </td>
        <td style="text-align:center;">
          <button class="track-heart-btn liked" title="Remove from Library">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
        </td>
        <td style="text-align:right; color:var(--spotify-subdued); font-variant-numeric:tabular-nums;">${track.durationFormatted || '3:20'}</td>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.track-heart-btn')) {
          e.stopPropagation();
          removeTrackFromLibrary(track.id);
          showLibraryDetail(false);
          return;
        }
        if (e.target.closest('.clickable-artist-link')) {
          e.stopPropagation();
          showArtistDetail({ name: track.artist });
          return;
        }
        if (e.target.closest('.clickable-album-link')) {
          e.stopPropagation();
          showAlbumDetail({ title: track.album, artist: track.artist, artwork: track.artwork });
          return;
        }
        if (State.currentTrack && State.currentTrack.id === track.id) {
          togglePlayPause();
          return;
        }
        State.currentPlayingContext = { type: 'library', id: 'user_library', title: 'Liked Songs' };
        State.queue = [...State.libraryTracks];
        State.queueIndex = index;
        renderQueueList();
        playFullTrack(track);
        addRecentItem(track);
      });

      tbody.appendChild(row);
    });
  }
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

  items.slice(0, 8).forEach(item => {
    const title = item.name || item.title;
    const sub = item.genre || `${item.year || ''} ${item.artist || item.curator || ''}`;
    const img = item.image || item.artwork;
    const isPlayingThis = (State.currentPlayingContext && State.currentPlayingContext.id === item.id && State.isPlaying) ||
                          (State.currentTrack && State.currentTrack.id === item.id && State.isPlaying);

    const card = document.createElement('div');
    card.className = 'shelf-card';
    card.setAttribute('data-id', item.id || '');
    card.innerHTML = `
      <div class="shelf-card-art-box ${isCircle ? 'circle' : ''}">
        <img class="shelf-card-art" src="${img}" alt="${title}" loading="lazy" decoding="async">
      </div>
      <div class="shelf-card-title">${title}</div>
      <div class="shelf-card-desc">${sub}</div>
      <button class="card-floating-play-btn ${isPlayingThis ? 'is-active' : ''}" title="Play ${title}" aria-label="Play ${title}">
        <svg viewBox="0 0 24 24"><path d="${isPlayingThis ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/></svg>
      </button>
    `;

    // Dedicated Green Play Button Click Handler
    const playBtn = card.querySelector('.card-floating-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addRecentItem(item);
        if (item.type === 'album' || sectionId === 'shelf-albums-section') {
          playAlbum(item);
        } else if (item.type === 'playlist' || sectionId === 'shelf-playlists-section') {
          playPlaylist(item);
        } else if (item.type === 'artist' || isCircle || sectionId === 'shelf-artists-section') {
          playArtist(item);
        } else {
          onClick(item);
        }
      });
    }

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
    const listToRender = tracks.length > 0 ? tracks : CURATED_TRACKS;
    titleElem.textContent = `Songs (${listToRender.length})`;
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

    listToRender.forEach((track, index) => {
      const isCurrent = State.currentTrack && State.currentTrack.id === track.id;
      const row = document.createElement('tr');
      row.className = `full-table-row ${isCurrent ? 'active' : ''}`;
      row.innerHTML = `
        <td style="text-align:center; color:var(--spotify-subdued);">${index + 1}</td>
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${track.artwork}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;" loading="lazy" decoding="async">
            <div>
              <div class="table-song-title" style="font-weight:600; color:${isCurrent ? 'var(--spotify-green)' : 'var(--spotify-white)'};">${track.name}</div>
              <div style="font-size:0.8rem; color:var(--spotify-subdued);" class="clickable-artist-link">${track.artist}</div>
            </div>
          </div>
        </td>
        <td style="color:var(--spotify-subdued);">
          <span class="clickable-album-link">${track.album || 'Single'}</span>
        </td>
        <td style="text-align:right; color:var(--spotify-subdued); font-variant-numeric:tabular-nums;">${track.durationFormatted}</td>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.clickable-artist-link')) {
          e.stopPropagation();
          showArtistDetail({ name: track.artist });
          return;
        }
        if (e.target.closest('.clickable-album-link')) {
          e.stopPropagation();
          showAlbumDetail({ title: track.album, artist: track.artist, artwork: track.artwork });
          return;
        }
        if (State.currentTrack && State.currentTrack.id === track.id) {
          togglePlayPause();
          return;
        }
        playFullTrack(track);
        addRecentItem(track);
      });

      tbody.appendChild(row);
    });

    container.appendChild(table);
  } else if (category === 'artists') {
    const list = artists.length > 0 ? artists : CURATED_ARTISTS;
    titleElem.textContent = `Artists (${list.length})`;
    const grid = document.createElement('div');
    grid.className = 'shelf-cards-grid';
    list.forEach(a => {
      const isPlayingThis = State.currentPlayingContext && State.currentPlayingContext.id === a.id && State.isPlaying;
      const card = document.createElement('div');
      card.className = 'shelf-card';
      card.setAttribute('data-id', a.id);
      card.innerHTML = `
        <div class="shelf-card-art-box circle">
          <img class="shelf-card-art" src="${a.image}" alt="${a.name}" loading="lazy">
        </div>
        <div class="shelf-card-title">${a.name}</div>
        <div class="shelf-card-desc">${a.genre || 'Artist'}</div>
        <button class="card-floating-play-btn ${isPlayingThis ? 'is-active' : ''}" title="Play ${a.name}" aria-label="Play ${a.name}">
          <svg viewBox="0 0 24 24"><path d="${isPlayingThis ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/></svg>
        </button>
      `;

      const playBtn = card.querySelector('.card-floating-play-btn');
      if (playBtn) {
        playBtn.onclick = (e) => {
          e.stopPropagation();
          playArtist(a);
        };
      }

      card.addEventListener('click', () => {
        showArtistDetail(a);
      });
      grid.appendChild(card);
    });
    container.appendChild(grid);
  } else if (category === 'albums') {
    const list = albums.length > 0 ? albums : CURATED_ALBUMS;
    titleElem.textContent = `Albums (${list.length})`;
    const grid = document.createElement('div');
    grid.className = 'shelf-cards-grid';
    list.forEach(al => {
      const isPlayingThis = State.currentPlayingContext && State.currentPlayingContext.id === al.id && State.isPlaying;
      const card = document.createElement('div');
      card.className = 'shelf-card';
      card.setAttribute('data-id', al.id);
      card.innerHTML = `
        <div class="shelf-card-art-box">
          <img class="shelf-card-art" src="${al.artwork || al.image}" alt="${al.title}" loading="lazy">
        </div>
        <div class="shelf-card-title">${al.title}</div>
        <div class="shelf-card-desc">${al.year || ''} • ${al.artist}</div>
        <button class="card-floating-play-btn ${isPlayingThis ? 'is-active' : ''}" title="Play ${al.title}" aria-label="Play ${al.title}">
          <svg viewBox="0 0 24 24"><path d="${isPlayingThis ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/></svg>
        </button>
      `;

      const playBtn = card.querySelector('.card-floating-play-btn');
      if (playBtn) {
        playBtn.onclick = (e) => {
          e.stopPropagation();
          playAlbum(al);
        };
      }

      card.onclick = () => showAlbumDetail(al);
      grid.appendChild(card);
    });
    container.appendChild(grid);
  } else if (category === 'playlists') {
    const list = playlists.length > 0 ? playlists : CURATED_PLAYLISTS;
    titleElem.textContent = `Playlists (${list.length})`;
    const grid = document.createElement('div');
    grid.className = 'shelf-cards-grid';
    list.forEach(p => {
      const isPlayingThis = State.currentPlayingContext && State.currentPlayingContext.id === p.id && State.isPlaying;
      const card = document.createElement('div');
      card.className = 'shelf-card';
      card.setAttribute('data-id', p.id);
      card.innerHTML = `
        <div class="shelf-card-art-box">
          <img class="shelf-card-art" src="${p.artwork || p.image}" alt="${p.title}" loading="lazy">
        </div>
        <div class="shelf-card-title">${p.title}</div>
        <div class="shelf-card-desc">${p.curator || 'Playlist'}</div>
        <button class="card-floating-play-btn ${isPlayingThis ? 'is-active' : ''}" title="Play ${p.title}" aria-label="Play ${p.title}">
          <svg viewBox="0 0 24 24"><path d="${isPlayingThis ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/></svg>
        </button>
      `;

      const playBtn = card.querySelector('.card-floating-play-btn');
      if (playBtn) {
        playBtn.onclick = (e) => {
          e.stopPropagation();
          playPlaylist(p);
        };
      }

      card.onclick = () => showPlaylistDetail(p);
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

  const btnPlayAllHomePlaylists = document.getElementById('btn-play-all-home-playlists');
  if (btnPlayAllHomePlaylists) {
    btnPlayAllHomePlaylists.addEventListener('click', () => playAllPlaylists());
  }

  const btnSeeAllHomePlaylists = document.getElementById('btn-see-all-home-playlists');
  if (btnSeeAllHomePlaylists) {
    btnSeeAllHomePlaylists.addEventListener('click', () => {
      setCategoryFilter('playlists');
      const chips = document.getElementById('filter-chips-bar');
      if (chips) chips.classList.add('visible');
    });
  }

  const navBtnPlaylists = document.getElementById('nav-btn-playlists');
  if (navBtnPlaylists) {
    navBtnPlaylists.addEventListener('click', () => {
      setActiveNav('playlists');
      setCategoryFilter('playlists');
      const chips = document.getElementById('filter-chips-bar');
      if (chips) chips.classList.add('visible');
    });
  }

  const btnPlayAllSongs = document.getElementById('btn-play-all-songs');
  if (btnPlayAllSongs) {
    btnPlayAllSongs.addEventListener('click', () => playAllSongs(State.currentSearchResults.tracks));
  }

  const btnPlayAllDrilldown = document.getElementById('btn-play-all-drilldown');
  if (btnPlayAllDrilldown) {
    btnPlayAllDrilldown.addEventListener('click', () => {
      const { tracks, albums, playlists } = State.currentSearchResults;
      if (State.activeCategory === 'tracks') {
        playAllSongs(tracks);
      } else if (State.activeCategory === 'albums') {
        const list = albums.length > 0 ? albums : CURATED_ALBUMS;
        if (list.length > 0) playAlbum(list[0]);
      } else if (State.activeCategory === 'playlists') {
        playAllPlaylists();
      } else {
        playAllSongs(tracks);
      }
    });
  }

  document.querySelectorAll('[data-see-all]').forEach(link => {
    link.addEventListener('click', (e) => {
      const cat = e.currentTarget.getAttribute('data-see-all');
      if (cat) {
        setCategoryFilter(cat);
      }
    });
  });

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
      showFloatingToast(State.isShuffle ? 'Shuffle On' : 'Shuffle Off');
      logUbiEvent('hitShuffleToggle', `enabled=${State.isShuffle}`);
    });
  }

  const repeatBtn = document.getElementById('btn-repeat');
  if (repeatBtn) {
    repeatBtn.addEventListener('click', () => {
      if (State.repeatMode === 'off') {
        State.repeatMode = 'all';
        repeatBtn.classList.remove('repeat-one');
        repeatBtn.style.color = 'var(--spotify-green)';
        repeatBtn.title = 'Repeat All (click for Repeat One)';
        showFloatingToast('Repeat All');
      } else if (State.repeatMode === 'all') {
        State.repeatMode = 'one';
        repeatBtn.classList.add('repeat-one');
        repeatBtn.style.color = 'var(--spotify-green)';
        repeatBtn.title = 'Repeat One (click to turn off)';
        showFloatingToast('Repeat One');
      } else {
        State.repeatMode = 'off';
        repeatBtn.classList.remove('repeat-one');
        repeatBtn.style.color = 'var(--spotify-subdued)';
        repeatBtn.title = 'Repeat Off';
        showFloatingToast('Repeat Off');
      }
      logUbiEvent('hitRepeatToggle', `mode=${State.repeatMode}`);
    });
  }

  const playerHeart = document.getElementById('player-heart-btn');
  if (playerHeart) {
    playerHeart.addEventListener('click', () => {
      if (State.currentTrack) toggleLikeTrack(State.currentTrack.id);
    });
  }

  const playerArtistEl = document.getElementById('player-track-artist');
  if (playerArtistEl) {
    playerArtistEl.classList.add('clickable-artist-link');
    playerArtistEl.addEventListener('click', () => {
      if (State.currentTrack && State.currentTrack.artist) {
        showArtistDetail({ name: State.currentTrack.artist });
      }
    });
  }

  // Smooth interactive seekbar scrubber (Click + Drag / Touch scrub)
  const timelineBar = document.getElementById('timeline-bar');
  const timelineFill = document.getElementById('timeline-fill');
  const timelineHandle = document.getElementById('timeline-handle');
  const timeCurr = document.getElementById('player-current-time');

  function updateTimelineScrubber(e) {
    if (!timelineBar) return 0;
    const rect = timelineBar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const pct = pos * 100;
    if (timelineFill) timelineFill.style.width = `${pct}%`;
    if (timelineHandle) timelineHandle.style.left = `${pct}%`;

    const progress = getPlaybackProgress();
    const duration = progress ? progress.duration : (State.currentTrack ? State.currentTrack.duration : 180);
    if (timeCurr) timeCurr.textContent = formatDuration(pos * duration);
    return pos;
  }

  function commitSeek(pos) {
    const progress = getPlaybackProgress();
    const dur = progress ? progress.duration : (State.currentTrack ? State.currentTrack.duration : 180);
    const targetTime = pos * dur;

    if (State.activeEngine === 'youtube' && ytPlayer && ytReady && typeof ytPlayer.seekTo === 'function') {
      ytPlayer.seekTo(targetTime, true);
    } else if (State.activeEngine === 'audio') {
      const audio = document.getElementById('audio-engine');
      if (audio && audio.duration) {
        audio.currentTime = targetTime;
      }
    } else {
      if (ytPlayer && ytReady && typeof ytPlayer.seekTo === 'function') {
        ytPlayer.seekTo(targetTime, true);
      }
      const audio = document.getElementById('audio-engine');
      if (audio && audio.duration) {
        audio.currentTime = targetTime;
      }
    }
    logUbiEvent('hitSeekTrack', `${formatDuration(targetTime)} (${Math.round(pos * 100)}%)`);
  }

  if (timelineBar) {
    timelineBar.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      isSeekingTimeline = true;
      timelineBar.classList.add('is-dragging');
      if (typeof timelineBar.setPointerCapture === 'function') {
        try { timelineBar.setPointerCapture(e.pointerId); } catch (_) {}
      }
      updateTimelineScrubber(e);
    });

    timelineBar.addEventListener('pointermove', (e) => {
      if (!isSeekingTimeline) return;
      e.preventDefault();
      updateTimelineScrubber(e);
    });

    const finishTimelineSeek = (e) => {
      if (!isSeekingTimeline) return;
      const finalPos = updateTimelineScrubber(e);
      commitSeek(finalPos);
      timelineBar.classList.remove('is-dragging');
      if (typeof timelineBar.releasePointerCapture === 'function') {
        try { timelineBar.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      setTimeout(() => { isSeekingTimeline = false; }, 80);
    };

    timelineBar.addEventListener('pointerup', finishTimelineSeek);
    timelineBar.addEventListener('pointercancel', finishTimelineSeek);
  }

  // Smooth interactive volume scrubber & Mute Toggle
  const volumeBar = document.getElementById('volume-bar');
  const volumeFill = document.getElementById('volume-fill');
  const volumeHandle = document.getElementById('volume-handle');
  const muteBtn = document.getElementById('btn-mute');

  let currentVolume = 0.8;
  let lastNonZeroVolume = 0.8;
  let isMuted = false;

  function setPlayerVolume(val) {
    val = Math.max(0, Math.min(1, val));
    currentVolume = val;
    isMuted = val === 0;
    const pct = val * 100;
    if (volumeFill) volumeFill.style.width = `${pct}%`;
    if (volumeHandle) volumeHandle.style.left = `${pct}%`;

    if (ytPlayer && ytReady && typeof ytPlayer.setVolume === 'function') {
      ytPlayer.setVolume(pct);
    }
    const audio = document.getElementById('audio-engine');
    if (audio) {
      audio.volume = val;
    }

    if (muteBtn) {
      const iconPath = muteBtn.querySelector('svg path');
      if (iconPath) {
        if (isMuted) {
          iconPath.setAttribute('d', 'M4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z');
          muteBtn.style.color = 'var(--spotify-subdued)';
          muteBtn.title = 'Unmute';
        } else if (val < 0.5) {
          iconPath.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z');
          muteBtn.style.color = 'var(--spotify-white)';
          muteBtn.title = 'Mute';
        } else {
          iconPath.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z');
          muteBtn.style.color = 'var(--spotify-white)';
          muteBtn.title = 'Mute';
        }
      }
    }
    return val;
  }

  function updateVolumeScrubber(e) {
    if (!volumeBar) return 0.8;
    const rect = volumeBar.getBoundingClientRect();
    const val = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (val > 0) lastNonZeroVolume = val;
    setPlayerVolume(val);
    return val;
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      if (isMuted || currentVolume === 0) {
        setPlayerVolume(lastNonZeroVolume > 0 ? lastNonZeroVolume : 0.8);
        showFloatingToast('Sound Unmuted');
      } else {
        lastNonZeroVolume = currentVolume > 0 ? currentVolume : 0.8;
        setPlayerVolume(0);
        showFloatingToast('Muted');
      }
    });
  }

  if (volumeBar) {
    volumeBar.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      isSeekingVolume = true;
      volumeBar.classList.add('is-dragging');
      if (typeof volumeBar.setPointerCapture === 'function') {
        try { volumeBar.setPointerCapture(e.pointerId); } catch (_) {}
      }
      updateVolumeScrubber(e);
    });

    volumeBar.addEventListener('pointermove', (e) => {
      if (!isSeekingVolume) return;
      e.preventDefault();
      updateVolumeScrubber(e);
    });

    const finishVolumeSeek = (e) => {
      if (!isSeekingVolume) return;
      isSeekingVolume = false;
      volumeBar.classList.remove('is-dragging');
      if (typeof volumeBar.releasePointerCapture === 'function') {
        try { volumeBar.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      updateVolumeScrubber(e);
    };

    volumeBar.addEventListener('pointerup', finishVolumeSeek);
    volumeBar.addEventListener('pointercancel', finishVolumeSeek);
  }

  // Audio engine fallback listeners for time & queue advancement
  const audioEngineEl = document.getElementById('audio-engine');
  if (audioEngineEl) {
    audioEngineEl.addEventListener('play', () => {
      State.activeEngine = 'audio';
      State.isPlaying = true;
      updatePlayerUI();
      startYtProgress();
    });
    audioEngineEl.addEventListener('pause', () => {
      if (State.activeEngine === 'audio') {
        State.isPlaying = false;
        updatePlayerUI();
        stopYtProgress();
      }
    });
    audioEngineEl.addEventListener('ended', () => {
      if (State.activeEngine === 'audio') {
        // If track has full YouTube stream available, seamlessly transition to full song
        if (State.currentTrack && State.currentTrack.youtubeId && ytPlayer && ytReady) {
          State.activeEngine = 'youtube';
          try {
            ytPlayer.loadVideoById(State.currentTrack.youtubeId);
            ytPlayer.playVideo();
            return;
          } catch (_) {}
        }
        console.log('Audio track ended, advancing to next song...');
        logUbiEvent('hitTrackEnded', State.currentTrack ? State.currentTrack.name : 'track');
        playNextTrack();
      }
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

  // Navigation history buttons (Back & Forward)
  const backBtn = document.getElementById('btn-history-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => NavHistory.back());
  }

  const fwdBtn = document.getElementById('btn-history-forward');
  if (fwdBtn) {
    fwdBtn.addEventListener('click', () => NavHistory.forward());
  }

  // Desktop Sidebar Navigation Handlers
  const navBtnHome = document.getElementById('nav-btn-home');
  if (navBtnHome) {
    navBtnHome.addEventListener('click', () => {
      NavHistory.push({ type: 'browse-all' });
      if (searchInput) searchInput.value = '';
      State.query = '';
      switchView('browse-all');
      const chips = document.getElementById('filter-chips-bar');
      if (chips) chips.classList.remove('visible');
      setActiveNav('home');
      const sv = document.getElementById('search-viewport');
      if (sv) sv.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const navBtnSearch = document.getElementById('nav-btn-search');
  if (navBtnSearch) {
    navBtnSearch.addEventListener('click', () => {
      setActiveNav('search');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    });
  }

  const libraryTitleNav = document.getElementById('library-title-nav');
  if (libraryTitleNav) {
    libraryTitleNav.addEventListener('click', () => {
      showLibraryDetail();
    });
  }

  // Global Keyboard Shortcuts (Ctrl+K or '/' to focus search, L for lyrics, F for fullscreen, Space for play/pause)
  window.addEventListener('keydown', (e) => {
    const isTyping = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);

    if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && !isTyping)) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    // Spacebar to toggle play/pause when not typing
    if (e.code === 'Space' && !isTyping) {
      e.preventDefault();
      togglePlayPause();
    }
    // L key for Lyrics
    if ((e.key === 'l' || e.key === 'L') && !isTyping && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleLyricsModal();
    }
    // F key for Fullscreen
    if ((e.key === 'f' || e.key === 'F') && !isTyping && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleFullscreen();
    }
    // M key for Mute
    if ((e.key === 'm' || e.key === 'M') && !isTyping && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const muteBtn = document.getElementById('btn-mute');
      if (muteBtn) muteBtn.click();
    }
    // Left/Right arrows for seek
    if (e.key === 'ArrowLeft' && !isTyping) {
      e.preventDefault();
      const prog = getPlaybackProgress();
      if (prog) seekPlaybackToSeconds(Math.max(0, prog.current - 5));
    }
    if (e.key === 'ArrowRight' && !isTyping) {
      e.preventDefault();
      const prog = getPlaybackProgress();
      if (prog) seekPlaybackToSeconds(Math.min(prog.duration, prog.current + 5));
    }
    // Escape closes all modals
    if (e.key === 'Escape') {
      closeLyricsModal();
      closeChatModal();
      closeAuthModal();
      closeFeedbackModal();
    }
  });

  // Lyrics Modal Event Bindings
  const btnToggleLyrics = document.getElementById('btn-toggle-lyrics');
  if (btnToggleLyrics) btnToggleLyrics.addEventListener('click', toggleLyricsModal);

  const btnCloseLyrics = document.getElementById('btn-close-lyrics-modal');
  if (btnCloseLyrics) btnCloseLyrics.addEventListener('click', closeLyricsModal);

  const lyricsOverlay = document.getElementById('lyrics-modal-overlay');
  if (lyricsOverlay) {
    lyricsOverlay.addEventListener('click', (e) => {
      if (e.target === lyricsOverlay) closeLyricsModal();
    });
  }

  const btnCopyLyrics = document.getElementById('btn-copy-lyrics');
  if (btnCopyLyrics) {
    btnCopyLyrics.addEventListener('click', () => {
      if (State.currentLyrics && (State.currentLyrics.plainLyrics || State.currentLyrics.syncedLyrics)) {
        const text = State.currentLyrics.plainLyrics || State.currentLyrics.syncedLyrics.replace(/\[\d+:\d+\.\d+\]/g, '').trim();
        navigator.clipboard.writeText(text).then(() => {
          showFloatingToast('Lyrics copied to clipboard!');
        }).catch(() => {
          showFloatingToast('Copied to clipboard');
        });
      } else {
        showFloatingToast('No lyrics available to copy');
      }
    });
  }

  // Fullscreen button
  const btnToggleFullscreen = document.getElementById('btn-toggle-fullscreen');
  if (btnToggleFullscreen) btnToggleFullscreen.addEventListener('click', toggleFullscreen);

  // Feedback Modal Event Bindings
  const btnHeaderFeedback = document.getElementById('btn-header-feedback');
  if (btnHeaderFeedback) btnHeaderFeedback.addEventListener('click', openFeedbackModal);

  const btnSidebarFeedback = document.getElementById('btn-sidebar-feedback');
  if (btnSidebarFeedback) btnSidebarFeedback.addEventListener('click', openFeedbackModal);

  const btnCloseFeedback = document.getElementById('btn-close-feedback-modal');
  if (btnCloseFeedback) btnCloseFeedback.addEventListener('click', closeFeedbackModal);

  const feedbackOverlay = document.getElementById('feedback-modal-overlay');
  if (feedbackOverlay) {
    feedbackOverlay.addEventListener('click', (e) => {
      if (e.target === feedbackOverlay) closeFeedbackModal();
    });
  }

  document.querySelectorAll('.feedback-cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.feedback-cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedFeedbackCategory = pill.getAttribute('data-cat') || 'General Feedback';
    });
  });

  const feedbackForm = document.getElementById('feedback-form');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', handleFeedbackSubmit);
  }

  const btnExportAllFeedback = document.getElementById('btn-export-feedback-all');
  if (btnExportAllFeedback) {
    btnExportAllFeedback.addEventListener('click', handleExportAllFeedbackExcel);
  }

  // Chat Importer Modal Event Bindings
  const btnHeaderChat = document.getElementById('btn-header-open-chat');
  if (btnHeaderChat) btnHeaderChat.addEventListener('click', openChatModal);

  const btnSidebarAdd = document.getElementById('btn-sidebar-add-songs');
  if (btnSidebarAdd) btnSidebarAdd.addEventListener('click', openChatModal);

  const btnCloseChat = document.getElementById('btn-close-chat-modal');
  if (btnCloseChat) btnCloseChat.addEventListener('click', closeChatModal);

  const modalOverlay = document.getElementById('chat-modal-overlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeChatModal();
    });
  }

  // Example Chips
  document.querySelectorAll('.chat-example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.getAttribute('data-example');
      const textarea = document.getElementById('chat-song-textarea');
      if (textarea && SAMPLE_INPUTS[type]) {
        textarea.value = SAMPLE_INPUTS[type];
        updateChatInputCounter();
      }
    });
  });

  const btnFillSample = document.getElementById('btn-chat-fill-sample');
  if (btnFillSample) {
    btnFillSample.addEventListener('click', () => {
      const textarea = document.getElementById('chat-song-textarea');
      if (textarea) {
        textarea.value = SAMPLE_INPUTS.lines;
        updateChatInputCounter();
      }
    });
  }

  const btnClearChat = document.getElementById('btn-chat-clear-input');
  if (btnClearChat) {
    btnClearChat.addEventListener('click', () => {
      const textarea = document.getElementById('chat-song-textarea');
      if (textarea) {
        textarea.value = '';
        updateChatInputCounter();
      }
    });
  }

  const chatTextarea = document.getElementById('chat-song-textarea');
  if (chatTextarea) {
    chatTextarea.addEventListener('input', updateChatInputCounter);
  }

  const btnSubmitImport = document.getElementById('btn-chat-submit-import');
  if (btnSubmitImport) {
    btnSubmitImport.addEventListener('click', executeChatImport);
  }

  // Library Toolbar Action Buttons
  const btnLibPlayAll = document.getElementById('btn-library-play-all');
  if (btnLibPlayAll) {
    btnLibPlayAll.addEventListener('click', () => {
      if (State.libraryTracks.length > 0) {
        playAllSongs(State.libraryTracks);
      }
    });
  }

  const btnLibClearAll = document.getElementById('btn-library-clear-all');
  if (btnLibClearAll) {
    btnLibClearAll.addEventListener('click', clearUserLibrary);
  }

  // Mobile Sidebar Drawer & Backdrop Handlers
  const btnMobileMenu = document.getElementById('btn-mobile-menu');
  const btnSidebarClose = document.getElementById('btn-sidebar-close');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const appSidebar = document.querySelector('.app-sidebar');

  function openMobileSidebar() {
    if (appSidebar) appSidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('open');
  }

  function closeMobileSidebar() {
    if (appSidebar) appSidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('open');
  }

  if (btnMobileMenu) btnMobileMenu.addEventListener('click', openMobileSidebar);
  if (btnSidebarClose) btnSidebarClose.addEventListener('click', closeMobileSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

  // Mobile Bottom Navigation Bar Bindings
  const mobileNavHome = document.getElementById('mobile-nav-home');
  const mobileNavSearch = document.getElementById('mobile-nav-search');
  const mobileNavLibrary = document.getElementById('mobile-nav-library');
  const mobileNavChat = document.getElementById('mobile-nav-chat');

  function setMobileNavActive(activeBtn) {
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
  }

  if (mobileNavHome) {
    mobileNavHome.addEventListener('click', () => {
      setMobileNavActive(mobileNavHome);
      closeMobileSidebar();
      if (searchInput) searchInput.value = '';
      onSearchInput({ target: { value: '' } });
      const viewport = document.getElementById('search-viewport');
      if (viewport) viewport.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (mobileNavSearch) {
    mobileNavSearch.addEventListener('click', () => {
      setMobileNavActive(mobileNavSearch);
      closeMobileSidebar();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    });
  }

  if (mobileNavLibrary) {
    mobileNavLibrary.addEventListener('click', () => {
      setMobileNavActive(mobileNavLibrary);
      closeMobileSidebar();
      showLibraryDetail();
    });
  }

  if (mobileNavChat) {
    mobileNavChat.addEventListener('click', () => {
      closeMobileSidebar();
      openChatModal();
    });
  }

  // ==========================================================================
  // Authentication & Cloud Sync Event Handlers
  // ==========================================================================
  const btnHeaderLogin = document.getElementById('btn-header-login');
  if (btnHeaderLogin) {
    btnHeaderLogin.addEventListener('click', () => openAuthModal('login'));
  }

  const btnSidebarAuth = document.getElementById('btn-sidebar-auth');
  if (btnSidebarAuth) {
    btnSidebarAuth.addEventListener('click', () => {
      if (State.authToken && State.currentUser) {
        const popover = document.getElementById('user-dropdown-popover');
        if (popover) {
          popover.style.display = popover.style.display === 'block' ? 'none' : 'block';
        }
      } else {
        openAuthModal('login');
      }
    });
  }

  const btnCloseAuth = document.getElementById('btn-close-auth-modal');
  if (btnCloseAuth) {
    btnCloseAuth.addEventListener('click', closeAuthModal);
  }

  const authOverlay = document.getElementById('auth-modal-overlay');
  if (authOverlay) {
    authOverlay.addEventListener('click', (e) => {
      if (e.target === authOverlay) closeAuthModal();
    });
  }

  const authTabLogin = document.getElementById('auth-tab-login');
  if (authTabLogin) {
    authTabLogin.addEventListener('click', () => openAuthModal('login'));
  }

  const authTabRegister = document.getElementById('auth-tab-register');
  if (authTabRegister) {
    authTabRegister.addEventListener('click', () => openAuthModal('register'));
  }

  const btnTogglePwd = document.getElementById('btn-toggle-pwd');
  if (btnTogglePwd) {
    btnTogglePwd.addEventListener('click', () => {
      const pwdInput = document.getElementById('auth-password-input');
      const confirmInput = document.getElementById('auth-password-confirm');
      if (pwdInput) {
        const isPwd = pwdInput.type === 'password';
        pwdInput.type = isPwd ? 'text' : 'password';
        if (confirmInput) confirmInput.type = isPwd ? 'text' : 'password';
        btnTogglePwd.textContent = isPwd ? '🔒' : '👁';
      }
    });
  }

  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAuthSubmit();
    });
  }

  const btnAuthSubmit = document.getElementById('btn-auth-submit');
  if (btnAuthSubmit) {
    btnAuthSubmit.addEventListener('click', handleAuthSubmit);
  }

  const userAvatarBtn = document.getElementById('user-avatar-btn');
  const userDropdownPopover = document.getElementById('user-dropdown-popover');
  if (userAvatarBtn && userDropdownPopover) {
    userAvatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdownPopover.style.display = userDropdownPopover.style.display === 'block' ? 'none' : 'block';
    });
  }

  document.addEventListener('click', (e) => {
    if (userDropdownPopover && userAvatarBtn) {
      if (!userAvatarBtn.contains(e.target) && !userDropdownPopover.contains(e.target)) {
        userDropdownPopover.style.display = 'none';
      }
    }
  });

  const btnUserSyncCloud = document.getElementById('btn-user-sync-cloud');
  if (btnUserSyncCloud) {
    btnUserSyncCloud.addEventListener('click', async () => {
      if (userDropdownPopover) userDropdownPopover.style.display = 'none';
      showBannerToast('Syncing songs with cloud database...');
      await syncServerLibrary();
      showBannerToast('Library synced with database!');
    });
  }

  const btnUserLogout = document.getElementById('btn-user-logout');
  if (btnUserLogout) {
    btnUserLogout.addEventListener('click', () => {
      if (userDropdownPopover) userDropdownPopover.style.display = 'none';
      handleLogout(true);
    });
  }

  // ==========================================================================
  // CLUSTER & SECURITY CONSOLE DASHBOARD EVENT HANDLERS
  // ==========================================================================
  const btnSecurityDashboard = document.getElementById('btn-header-security-dashboard');
  const securityModalOverlay = document.getElementById('security-modal-overlay');
  const btnCloseSecurityModal = document.getElementById('btn-close-security-modal');
  const btnRefreshTelemetry = document.getElementById('btn-refresh-cluster-telemetry');
  const btnSimulateConflict = document.getElementById('btn-simulate-device-conflict');

  async function updateSecurityTelemetry() {
    try {
      const res = await fetch('/api/load-balancer');
      if (res.ok) {
        const data = await res.json();
        const algoEl = document.getElementById('sec-balancer-algo');
        const workerEl = document.getElementById('sec-worker-info');
        const cpuEl = document.getElementById('sec-cpu-info');
        const ipEl = document.getElementById('sec-client-ip');

        if (algoEl) algoEl.textContent = data.balancer || 'SCHED_RR (Round-Robin)';
        if (workerEl) workerEl.textContent = `Worker #${data.workerId || 1} (PID: ${data.workerPid || 'active'})`;
        if (cpuEl) cpuEl.textContent = `${data.totalCPUs || 4} Cores (${data.isClustered ? 'Clustered' : 'Single'})`;
        if (ipEl) ipEl.textContent = data.clientIp || '127.0.0.1';
      }
    } catch (_) {}

    // Check lease
    const devEl = document.getElementById('sec-lease-device');
    const badgeEl = document.getElementById('sec-lease-badge');
    if (State.authToken) {
      try {
        const leaseRes = await fetch('/api/v1/stream/lease', {
          headers: { 'Authorization': `Bearer ${State.authToken}` }
        });
        if (leaseRes.ok) {
          const lData = await leaseRes.json();
          if (lData.active && lData.lease) {
            if (devEl) devEl.textContent = lData.lease.deviceName || 'Web Player';
            if (badgeEl) { badgeEl.textContent = 'ACTIVE'; badgeEl.className = 'sec-pill green'; }
          } else {
            if (devEl) devEl.textContent = State.isPlaying ? 'Web Player (Local)' : 'None (Idle)';
            if (badgeEl) { badgeEl.textContent = State.isPlaying ? 'ACTIVE' : 'IDLE'; badgeEl.className = State.isPlaying ? 'sec-pill green' : 'sec-pill blue'; }
          }
        }
      } catch (_) {}
    } else {
      if (devEl) devEl.textContent = State.isPlaying ? 'Web Player (Local Only)' : 'None (Idle)';
      if (badgeEl) {
        badgeEl.textContent = State.isPlaying ? 'LOCAL (No Lease)' : 'IDLE';
        badgeEl.className = 'sec-pill blue';
      }
    }

    // Update PoW Latency and Risk Score with real telemetry or explicit example label
    const powLatencyEl = document.getElementById('sec-pow-latency');
    const riskScoreEl = document.getElementById('sec-risk-score');
    if (powLatencyEl) {
      powLatencyEl.textContent = latestSecurityTelemetry.powLatencyMs !== null
        ? `${latestSecurityTelemetry.powLatencyMs} ms (Live)`
        : 'Not tested (Example: ~1-5 ms)';
    }
    if (riskScoreEl) {
      riskScoreEl.textContent = latestSecurityTelemetry.riskScore !== null
        ? `${latestSecurityTelemetry.riskScore} / 100 (${latestSecurityTelemetry.riskScore < 30 ? 'Clean' : 'Elevated'})`
        : 'Not evaluated (Example: 0 / 100)';
    }
  }

  function openSecurityModal() {
    if (securityModalOverlay) securityModalOverlay.style.display = 'flex';
    updateSecurityTelemetry();
  }

  function closeSecurityModal() {
    if (securityModalOverlay) securityModalOverlay.style.display = 'none';
  }

  if (btnSecurityDashboard) btnSecurityDashboard.addEventListener('click', openSecurityModal);
  if (btnCloseSecurityModal) btnCloseSecurityModal.addEventListener('click', closeSecurityModal);
  if (securityModalOverlay) {
    securityModalOverlay.addEventListener('click', (e) => {
      if (e.target === securityModalOverlay) closeSecurityModal();
    });
  }

  // Deep-link and URL query trigger support for Security Console
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#security') openSecurityModal();
  });
  if (window.location.hash === '#security' || new URLSearchParams(window.location.search).has('security')) {
    setTimeout(openSecurityModal, 150);
  }

  if (btnRefreshTelemetry) {
    btnRefreshTelemetry.addEventListener('click', () => {
      updateSecurityTelemetry();
      showFloatingToast('Cluster telemetry refreshed');
    });
  }

  if (btnSimulateConflict) {
    btnSimulateConflict.addEventListener('click', async () => {
      if (!State.authToken) {
        showFloatingToast('Please log in first to test stream leasing');
        return;
      }
      try {
        showFloatingToast('Simulating playback from iPhone in Kitchen...');
        const res = await fetch('/api/v1/stream/lease', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${State.authToken}`
          },
          body: JSON.stringify({
            deviceId: 'iphone_kitchen_' + Date.now(),
            deviceName: 'iPhone (Kitchen)'
          })
        });
        if (res.ok) {
          updateSecurityTelemetry();
          showBannerToast('Conflict simulated: iPhone Kitchen claimed the lease! Next web heartbeat will pause.', 5000);
        }
      } catch (_) {}
    });
  }

  // Check and update auth UI on startup
  updateAuthUI();

  // Initialize Library UI immediately from local storage for instant paint
  renderSidebarLibrary();
  updatePlayerUI();
  logUbiEvent('hitSessionStart', 'desktop-find.browseAll');

  // Defer non-critical background network synchronization to prevent startup contention
  setTimeout(() => {
    syncServerLibrary();

    if (State.authToken) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${State.authToken}` }
      })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data && data.user) {
          State.currentUser = data.user;
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
          updateAuthUI();
        }
      })
      .catch(() => {
        handleLogout(false);
      });
    }
  }, 20);

  // Register Android PWA Service Worker for standalone installability and instant caching
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
});
