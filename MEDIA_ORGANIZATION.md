# Media Organization Rules

These rules are mandatory for every media import. They are permanent and do not change.

The objective is a library that scales to thousands of titles without ever requiring reorganization.

---

## Core Principle

Never place media files directly inside a root library folder.
Every title gets its own folder. Always.

---

## Movies

```
/srv/media/movies/

Movie Title (Year)/
    Movie Title (Year).mkv
```

**Examples:**
```
/srv/media/movies/

Interstellar (2014)/
    Interstellar (2014).mkv

Top Gun: Maverick (2022)/
    Top Gun: Maverick (2022).mkv

Toy Story (1995)/
    Toy Story (1995).mkv
```

**Rules:**
- Folder name = File name (without extension)
- Always include the release year in parentheses
- Match punctuation exactly (colons, apostrophes) for best metadata matching
- If auto-match fails, append TMDb ID: `Elf (2003) [tmdbid-9273]`

---

## TV Shows

```
/srv/media/tv/

Series Name/
    Season 01/
        Series Name S01E01.mkv
        Series Name S01E02.mkv

    Season 02/
        Series Name S02E01.mkv
```

**Example:**
```
Breaking Bad/
    Season 01/
        Breaking Bad S01E01.mkv
        Breaking Bad S01E02.mkv
    Season 02/
        Breaking Bad S02E01.mkv
```

**Rules:**
- Use `SxxExx` format — zero-padded (S01E01 not S1E1)
- Season folder: `Season 01` (not `Season 1`)
- Series folder has no year suffix

---

## Music

```
/srv/media/music/

Artist Name/
    Album Title (Year)/
        01 Track Name.flac
        02 Track Name.flac
```

**Rules:**
- Track numbers zero-padded: `01`, `02`, not `1`, `2`
- Preferred formats: FLAC, MP3, AAC

---

## Audiobooks

```
/srv/media/audiobooks/

Author Name/
    Book Title/
        Chapter 01.mp3
        Chapter 02.mp3
```

---

## Home Videos

```
/srv/media/home-videos/

2026/
    Disney Vacation/
        Disney Vacation Day 1.mp4

2027/
    Christmas/
        Christmas Morning.mp4
```

**Rules:**
- Top level is year (YYYY)
- Second level is event name
- File names should describe the content

---

## Family Photos

```
/srv/media/family-photos/

2026/
    Yellowstone/

2027/
    Christmas/
```

---

## Supported Formats

| Format | Status | Notes |
|---|---|---|
| `.mkv` | Preferred | Universal container, best compatibility |
| `.mp4` | Preferred | Widely compatible |
| `.m4v` | Acceptable | Apple variant of MP4 |
| `.flac` | Preferred (music) | Lossless audio |
| `.mp3` | Acceptable | Compressed audio |
| `.avi` | Legacy | May require transcoding |
| `.mov` | Legacy | Large files, avoid for new imports |
| `.wmv` | Avoid | Always transcodes, poor compatibility |

**Preferred video codecs:** H.264 (widest compatibility), H.265/HEVC (better compression)

---

## Permanent Import Workflow

Every import follows this exact sequence. No exceptions.

```
1. Verify filename matches naming convention
2. Verify folder name matches naming convention
3. Copy file into /srv/media/staging/
4. Verify playback in staging (confirm file is not corrupt)
5. Move file into permanent library location
6. Trigger Jellyfin library scan (Dashboard → Scan Libraries, or wait ~60s)
7. Verify metadata downloaded correctly
8. Verify poster artwork downloaded
9. Verify movie/show appears in the library
10. Verify playback from browser
11. Verify playback from Android TV (for new titles)
12. Delete staging copy
```

**No media enters the permanent library without first passing through staging.**

---

## Standard Workflow — Drag and Drop (Preferred)

No terminal required for normal media management.

```
1. Open Finder → Connect to Server → smb://media-server.local/incoming
2. Drag the media file into the Incoming share (staging)
3. Verify the file copied completely
4. Open smb://media-server.local/media in a second Finder window
5. Create the correct folder inside movies/, tv/, etc.
   Example: movies/Interstellar (2014)/
6. Move the file from incoming/ into the new folder
7. Jellyfin auto-detects the file within ~60 seconds
8. Verify metadata and artwork appear in Jellyfin
9. Verify playback
10. The incoming/ folder clears itself (no cleanup needed — it's now in the library)
```

## Terminal Workflow (Alternative — SSH)

Use only when Finder is unavailable or for bulk imports.

**Copy to staging via SCP:**
```bash
scp "/path/to/Movie Title (Year).mkv" sean@10.0.0.226:/srv/media/staging/
```

**Create folder and move to library (on Pi):**
```bash
mkdir -p "/srv/media/movies/Movie Title (Year)"
mv "/srv/media/staging/Movie Title (Year).mkv" "/srv/media/movies/Movie Title (Year)/"
```

---

## Metadata Rules

- Use Jellyfin's official metadata providers (TMDb for movies, TheTVDB for TV)
- Do not manually edit metadata unless auto-match fails
- Prefer accurate filenames over manual corrections
- If a match fails, add the TMDb/TVDB ID to the folder name
- Never delete artwork automatically
- Never overwrite metadata without confirmation

---

## Library Rules

- Never reorganize existing media automatically
- Never rename folders without approval
- Never delete artwork automatically
- Never overwrite metadata without confirmation
- Preserve watched history whenever possible
