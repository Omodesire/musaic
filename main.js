// Paste your own free YouTube Data API key here — see the setup steps we walked through.
// Without a real key, the app automatically falls back to 30-second iTunes previews.
const YOUTUBE_API_KEY = 'PASTE_YOUR_KEY_HERE';

const search = document.getElementById('search');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const result = document.getElementById('result'); // song details
const border = document.getElementById('border');  // artwork
const videoContainer = document.getElementById('videoContainer'); // full song
const player = document.getElementById('player');  // 30-second fallback preview

search.addEventListener('submit', function (e) {
    e.preventDefault();

    const query = searchInput.value.trim();

    if (query === '') {
        result.innerHTML = '<p class="empty-text">Please type a song name to search for.</p>';
        return;
    }

    getInfo(query);
});

// Splits "Song Name by Artist Name" into its two parts.
// If there's no " by " in the text, treats the whole thing as just a song title.
function parseQuery(raw) {
    const byMatch = raw.match(/^(.*)\sby\s(.*)$/i);

    if (byMatch) {
        return {
            songTitle: byMatch[1].trim(),
            artistName: byMatch[2].trim()
        };
    }

    return { songTitle: raw, artistName: null };
}

async function getInfo(rawQuery) {
    const { songTitle, artistName } = parseQuery(rawQuery);

    // Build a more precise search if we know the artist,
    // otherwise fall back to a plain general search
    const searchQuery = artistName
        ? `recording:"${songTitle}" AND artist:"${artistName}"`
        : songTitle;

    let url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(searchQuery)}&fmt=json`;

    result.innerHTML = '<p class="loading-text">Searching...</p>';
    border.innerHTML = '';
    videoContainer.innerHTML = '';
    videoContainer.style.display = 'none';
    player.style.display = 'none';
    player.removeAttribute('src');

    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log(data);

        if (!data.recordings || data.recordings.length === 0) {
            result.innerHTML = '<p class="empty-text">No results found.</p>';
            border.innerHTML = '<p class="empty-text">No artwork available.</p>';
            return;
        }

        // Always use the top (best-matching) song
        const topSong = data.recordings[0];

        displaySongDetails(topSong); // bottom container
        loadArtwork(topSong);        // top container
        loadFullSong(topSong);       // full song via YouTube, falls back to 30s preview

    } catch (error) {
        console.error('Error fetching data:', error);
        result.innerHTML = '<p class="empty-text">Something went wrong. Please try again.</p>';
        border.innerHTML = '<p class="empty-text">No artwork available.</p>';
    }
}

function displaySongDetails(song) {
    const title = song.title || 'Unknown title';
    const artist = song['artist-credit']
        ? song['artist-credit'][0].name
        : 'Unknown artist';
    const releaseDate = song['first-release-date'] || 'Unknown release date';

    result.innerHTML = `
        <h2>${title}</h2>
        <p>Artist: ${artist}</p>
        <p>First released: ${releaseDate}</p>
    `;
}

// Wraps image loading in a Promise so we can await it inside a loop
function tryLoadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject();
        img.src = url;
    });
}

async function loadArtwork(song) {
    border.innerHTML = '<p class="loading-text">Loading artwork...</p>';

    if (!song.releases || song.releases.length === 0) {
        border.innerHTML = '<p class="empty-text">No artwork available.</p>';
        return;
    }

    // Try every release this song appeared on, in order,
    // until we find one that actually has cover art uploaded
    for (const release of song.releases) {
        const artUrl = `https://coverartarchive.org/release/${release.id}/front`;
        try {
            const img = await tryLoadImage(artUrl);
            img.alt = `${song.title} artwork`;
            border.innerHTML = '';
            border.appendChild(img);
            return; // found one, stop looking
        } catch (e) {
            continue; // this release had no art, try the next one
        }
    }

    // none of the releases had artwork
    border.innerHTML = '<p class="empty-text">No artwork available.</p>';
}

// Searches YouTube for this song and embeds their official player, so the whole
// track can play — not just a 30-second clip. Falls back to loadPreview() if
// there's no API key set yet, or if nothing is found.
async function loadFullSong(song) {
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'PASTE_YOUR_KEY_HERE') {
        loadPreview(song);
        return;
    }

    const title = song.title || '';
    const artist = song['artist-credit'] ? song['artist-credit'][0].name : '';
    const term = `${title} ${artist}`.trim();

    if (term === '') {
        loadPreview(song);
        return;
    }

    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(term)}&key=${YOUTUBE_API_KEY}`;
        const response = await fetch(searchUrl);
        const data = await response.json();

        const videoId = data.items && data.items[0] && data.items[0].id
            ? data.items[0].id.videoId
            : null;

        if (!videoId) {
            loadPreview(song);
            return;
        }

        videoContainer.innerHTML = `
            <iframe
                src="https://www.youtube.com/embed/${videoId}?rel=0"
                title="${title}"
                allow="accelerate-motion; autoplay; encrypted-media"
                allowfullscreen>
            </iframe>
        `;
        videoContainer.style.display = 'block';

    } catch (error) {
        console.error('Error fetching YouTube video:', error);
        loadPreview(song);
    }
}

// Looks up a 30-second preview clip for the song via Apple's iTunes Search API
// (MusicBrainz has no audio itself, just song information)
async function loadPreview(song) {
    const title = song.title || '';
    const artist = song['artist-credit'] ? song['artist-credit'][0].name : '';
    const term = `${title} ${artist}`.trim();

    if (term === '') {
        return;
    }

    try {
        const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=1`;
        const response = await fetch(itunesUrl);
        const data = await response.json();

        if (data.results && data.results.length > 0 && data.results[0].previewUrl) {
            player.src = data.results[0].previewUrl;
            player.style.display = 'block';
        } else {
            player.style.display = 'none';
            player.removeAttribute('src');
        }
    } catch (error) {
        console.error('Error fetching preview:', error);
        player.style.display = 'none';
        player.removeAttribute('src');
    }
}
