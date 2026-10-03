// Paste your own free YouTube Data API key here — see the setup steps we walked through.
// Without a real key, the app automatically falls back to 30-second iTunes previews.
const YOUTUBE_API_KEY = 'PASTE_YOUR_KEY_HERE';

const search = document.getElementById('search');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const result = document.getElementById('result'); // song details
const border = document.getElementById('border');  // artwork
const videoContainer = document.getElementById('videoContainer'); // full song
const playerCard = document.getElementById('playerCard');         // custom player UI
const playButton = document.getElementById('playButton');
const progressTrack = document.getElementById('progressTrack');
const progressFill = document.getElementById('progressFill');
const timeDisplay = document.getElementById('timeDisplay');
const player = document.getElementById('player');  // 30-second fallback preview (hidden, controlled by the UI above)
const previewNote = document.getElementById('previewNote'); // clarifies preview vs. full song

const lyricsModal = document.getElementById('lyricsModal');
const lyricsFrame = document.getElementById('lyricsFrame');
const lyricsExternalLink = document.getElementById('lyricsExternalLink');
const closeLyricsModal = document.getElementById('closeLyricsModal');

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
    playerCard.style.display = 'none';
    player.removeAttribute('src');
    previewNote.style.display = 'none';

    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log(data);

        if (!data.recordings || data.recordings.length === 0) {
            result.innerHTML = '<p class="empty-text">No results found.</p>';
            showDefaultArtwork();
            return;
        }

        if (artistName) {
            // The search already named an artist, so this is precise enough
            // to go straight to the top match
            selectSong(data.recordings[0]);
        } else {
            // A bare song title is ambiguous — tons of artists cover the same
            // songs — so let the person choose which one they meant
            const choices = dedupeRecordings(data.recordings).slice(0, 5);

            if (choices.length === 1) {
                selectSong(choices[0]);
            } else {
                showSongChoices(choices);
            }
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        result.innerHTML = '<p class="empty-text">Something went wrong. Please try again.</p>';
        showDefaultArtwork();
    }
}

// Loads one specific song into all three panels — this is the single place
// that "finalizes" a choice, whether it came from an exact match or a pick-list click
function selectSong(song) {
    displaySongDetails(song); // bottom container
    loadArtwork(song);        // top container
    loadFullSong(song);       // full song via YouTube, falls back to 30s preview
}

// MusicBrainz often returns the same song multiple times (once per release
// it appeared on). This keeps only the first occurrence of each
// title + artist combination, so the pick-list doesn't repeat itself.
function dedupeRecordings(recordings) {
    const seen = new Set();
    const unique = [];

    for (const song of recordings) {
        const artist = song['artist-credit'] ? song['artist-credit'][0].name : '';
        const key = `${song.title}::${artist}`.toLowerCase();

        if (!seen.has(key)) {
            seen.add(key);
            unique.push(song);
        }
    }

    return unique;
}

// Shows a short list of candidate songs in the bottom container and lets
// the person click the one they meant
function showSongChoices(songs) {
    showDefaultArtwork();
    videoContainer.style.display = 'none';
    playerCard.style.display = 'none';
    previewNote.style.display = 'none';

    const items = songs.map((song, index) => {
        const title = song.title || 'Unknown title';
        const artist = song['artist-credit']
            ? song['artist-credit'][0].name
            : 'Unknown artist';

        return `
            <li data-index="${index}">
                <span class="choice-title">${title}</span>
                <span class="choice-artist">${artist}</span>
            </li>
        `;
    }).join('');

    result.innerHTML = `
        <div class="media-label">Choose a song</div>
        <ul class="song-choices">${items}</ul>
    `;

    result.querySelectorAll('.song-choices li').forEach(function (li) {
        li.addEventListener('click', function () {
            const index = Number(li.dataset.index);
            selectSong(songs[index]);
        });
    });
}

function displaySongDetails(song) {
    const title = song.title || 'Unknown title';
    const artist = song['artist-credit']
        ? song['artist-credit'][0].name
        : 'Unknown artist';
    const releaseDate = song['first-release-date'] || 'Unknown release date';

    // Link out to the official lyrics page rather than displaying lyrics
    // text directly — lyrics are licensed content, and genius.com is where
    // they're actually authorized to be published
    const lyricsUrl = `https://genius.com/search?q=${encodeURIComponent(`${title} ${artist}`)}`;

    result.innerHTML = `
        <h2>${title}</h2>
        <p>Artist: ${artist}</p>
        <p>First released: ${releaseDate}</p>
        <button class="lyrics-link" type="button">View lyrics</button>
    `;

    result.querySelector('.lyrics-link').addEventListener('click', function () {
        openLyricsModal(lyricsUrl);
    });
}

// Opens the lyrics modal and loads Genius's own official page inside it.
// We never extract or store lyrics text ourselves — this just displays
// their licensed page, the same way embedding a YouTube video does.
function openLyricsModal(url) {
    lyricsExternalLink.href = url;
    lyricsFrame.src = url;
    lyricsModal.hidden = false;
}

function hideLyricsModal() {
    lyricsModal.hidden = true;
    lyricsFrame.src = ''; // stop loading/playing anything once closed
}

closeLyricsModal.addEventListener('click', hideLyricsModal);

// Clicking the dark backdrop (not the modal box itself) also closes it
lyricsModal.addEventListener('click', function (e) {
    if (e.target === lyricsModal) {
        hideLyricsModal();
    }
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !lyricsModal.hidden) {
        hideLyricsModal();
    }
});

// Shown whenever no real cover art could be found — a simple drawn
// vinyl record instead of a broken image or plain text
function showDefaultArtwork() {
    border.innerHTML = `
        <div class="artwork-empty">
            <svg class="default-cover" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="100" r="92" fill="#14100C" />
                <circle cx="100" cy="100" r="74" fill="none" stroke="#2A241D" stroke-width="2" />
                <circle cx="100" cy="100" r="56" fill="none" stroke="#2A241D" stroke-width="2" />
                <circle cx="100" cy="100" r="38" fill="none" stroke="#2A241D" stroke-width="2" />
                <circle cx="100" cy="100" r="30" fill="#E3A542" />
                <circle cx="100" cy="100" r="5" fill="#14100C" />
            </svg>
            <p>No cover art available</p>
        </div>
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
        showDefaultArtwork();
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
    showDefaultArtwork();
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
            // Reset the custom player UI for this new clip
            playButton.textContent = '▶';
            progressFill.style.width = '0%';
            timeDisplay.textContent = '0:00 / 0:00';

            player.src = data.results[0].previewUrl;
            playerCard.style.display = 'flex';
            previewNote.textContent = "Full song unavailable — here's a 30-second preview";
            previewNote.style.display = 'block';
        } else {
            playerCard.style.display = 'none';
            player.removeAttribute('src');
        }
    } catch (error) {
        console.error('Error fetching preview:', error);
        playerCard.style.display = 'none';
        player.removeAttribute('src');
    }
}

// Turns a number of seconds into "m:ss" for the time display
function formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// Wires up the custom player controls once — these elements exist for the
// whole life of the page, so this only needs to run a single time.
playButton.addEventListener('click', function () {
    if (player.paused) {
        player.play();
        playButton.textContent = '❚❚';
    } else {
        player.pause();
        playButton.textContent = '▶';
    }
});

player.addEventListener('timeupdate', function () {
    if (!player.duration) return;
    const percent = (player.currentTime / player.duration) * 100;
    progressFill.style.width = `${percent}%`;
    timeDisplay.textContent = `${formatTime(player.currentTime)} / ${formatTime(player.duration)}`;
});

player.addEventListener('ended', function () {
    playButton.textContent = '▶';
    progressFill.style.width = '0%';
});

progressTrack.addEventListener('click', function (e) {
    if (!player.duration) return;
    const rect = progressTrack.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    player.currentTime = clickPosition * player.duration;
});
