# Privacy and Safe Downloads

A checklist for safer browsing and media acquisition on your Mac. This document covers browser setup, download hygiene, VPN, DNS, and the recommended workflow for getting media into your library.

---

## 1. Browser

**Recommended: Firefox**

Firefox is the preferred browser for privacy-focused browsing. It is the only major browser that ships with strong privacy defaults and supports the full version of uBlock Origin.

| Browser | uBlock Origin | Notes |
|---|---|---|
| **Firefox** | ✅ Full uBlock Origin | Recommended |
| Chrome / Edge / Brave | ⚠️ uBlock Origin Lite only | Manifest V3 limitation — reduced blocking capability |
| Safari | ❌ Not available | No equivalent |

### Install uBlock Origin for Firefox

1. Open Firefox
2. Go to: [addons.mozilla.org/en-US/firefox/addon/ublock-origin](https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/)
3. Click **Add to Firefox**
4. Default filter lists are sufficient — no additional configuration required

> **Note on uBlock Origin Lite:** If you use Chrome or Edge, uBlock Origin Lite is the closest available equivalent. It runs in Manifest V3 mode with reduced capabilities — some ads and trackers that full uBlock Origin blocks will pass through. Firefox avoids this limitation entirely.

### Recommended Firefox Settings

| Setting | Where | Value |
|---|---|---|
| Enhanced Tracking Protection | Privacy & Security | Strict |
| DNS over HTTPS | Network Settings | Enable (see DNS section below) |
| Send websites a "Do Not Track" signal | Privacy & Security | Always |
| Delete cookies when Firefox closes | Privacy & Security | Optional — log out of sites on close |

---

## 2. Safe Download Rules

### Identifying a safe download

| Sign | Meaning |
|---|---|
| Download comes from the software's official website | Safe |
| URL matches the publisher's known domain | Safe |
| File is a `.dmg` or `.pkg` directly, no installer wrapper | Safe |
| File came from the Mac App Store | Safe |

### Red flags — stop and close the tab

| Sign | What it is |
|---|---|
| A popup saying "Your Mac is infected" | Fake alert — close the tab immediately |
| A "Download" button that is larger or more prominent than the real one | Fake download button |
| The download is a `.exe` file | Windows executable — wrong platform, discard |
| Installer asks to install "optional offers" or partner software | Bundled adware |
| A page redirected you from somewhere unexpected before the download started | Ad redirect — discard the file |
| The file name includes words like `setup`, `installer`, `downloader`, or `helper` when you expected a direct app | Wrapper installer — discard |

### Before opening any downloaded file

1. Check the file in Finder → right-click → Get Info → confirm the file type matches what you expected
2. If macOS shows a warning ("app from unidentified developer"), verify the source before proceeding
3. Never grant an installer more permissions than it needs — if it asks for Full Disk Access to install a simple utility, decline

---

## 3. VPN

A VPN (Virtual Private Network) encrypts your internet traffic and routes it through a server in another location. This hides your browsing activity from your Internet Service Provider (ISP) and improves privacy on public networks (coffee shops, hotels, airports).

### When a VPN helps

| Situation | VPN helps? |
|---|---|
| Using public Wi-Fi | ✅ Yes — hides traffic from the network operator |
| Hiding activity from your ISP | ✅ Yes — ISP sees encrypted tunnel, not destinations |
| Accessing geo-restricted content on streaming services | ✅ Yes — for services that allow it in their terms |
| General home browsing (trusted network) | Optional — low risk without it |

### Choosing a VPN

Look for a VPN with a verified no-logs policy. Well-regarded options:

- **Mullvad** — privacy-focused, accepts anonymous payment, no account email required
- **ProtonVPN** — Swiss-based, audited, free tier available
- **IVPN** — independent, audited, minimal data collection

Avoid free VPNs from unknown publishers — many log and sell traffic data, which is the opposite of what a VPN is for.

### VPN and your Media Server

Your Media Server runs on the local network (`10.0.0.0/24`). When a VPN is active, local network access (Jellyfin at `10.0.0.225:8096`, Samba shares) may be blocked depending on the VPN's settings.

If Jellyfin or the Samba shares become unreachable while on VPN:
- Use your VPN's **split tunneling** feature to exclude local network traffic
- Or disable the VPN when accessing the Media Server on your home network

---

## 4. DNS

Your Internet Service Provider (ISP) assigns a DNS server by default. ISP DNS is often slower than alternatives and may filter or log your queries.

Switching to a faster, privacy-respecting DNS resolver improves page load speeds and removes ISP-level query logging.

### Recommended DNS resolvers

| Resolver | Address | Features |
|---|---|---|
| **Cloudflare** | `1.1.1.1` / `1.0.0.1` | Fast, privacy policy, no logging |
| **Cloudflare + malware blocking** | `1.1.1.2` / `1.0.0.2` | Blocks known malware domains |
| **Cloudflare + adult content blocking** | `1.1.1.3` / `1.0.0.3` | Malware + adult content filter |
| **Quad9** | `9.9.9.9` / `149.112.112.112` | Malware blocking, nonprofit, privacy-focused |
| **NextDNS** | Custom | Per-device filtering rules, family profiles, analytics |

### Setting DNS on macOS

**System Settings → Wi-Fi → your network → Details → DNS**

1. Click the `+` button under DNS Servers
2. Remove the existing ISP DNS entry (if desired)
3. Add your chosen resolver (e.g. `1.1.1.1` and `1.0.0.1`)
4. Click OK → Apply

To enable DNS over HTTPS in Firefox specifically:
**Settings → General → Network Settings → Enable DNS over HTTPS → choose provider**

### DNS and your Media Server

Local hostname resolution (`media-server.local`) uses mDNS/Bonjour, not external DNS. Changing your DNS resolver has no effect on local network access to Jellyfin or the Samba shares.

---

## 5. Media Server Import Workflow

The complete workflow for getting media from your Mac into Jellyfin:

```
Legally acquired media file
        ↓
  ~/Desktop/Media Drop/
        ↓ (Media Drop service detects and processes automatically)
  /srv/media/ on the Pi
        ↓ (Jellyfin library scan triggered automatically)
  Jellyfin library
        ↓
  TV / Phone / Browser
```

### Folder routing (automatic)

| File naming pattern | Destination folder |
|---|---|
| `Movie Title (Year).mkv` | `/srv/media/movies/Movie Title (Year)/` |
| `Show Name S01E01.mkv` | `/srv/media/tv/Show Name/Season 01/` |
| Drop into `Kids/` subfolder | `/srv/media/kids/` |
| Drop into `Home Videos/` subfolder | `/srv/media/home-videos/` |

### Steps

1. Obtain the media file (purchase, rip from physical media you own, or download from a service that provides file downloads)
2. Drop the file into `~/Desktop/Media Drop/` or a named subfolder within it
3. Media Drop detects the file, waits for it to finish copying, routes it to the correct library, and triggers a Jellyfin scan
4. A macOS notification confirms the import
5. Open Jellyfin on your TV or browser — the file appears in the library

If a file fails to import, it moves to `~/Desktop/Media Drop/Failed/` with a log entry explaining the reason.

---

## Quick Reference

| Task | Action |
|---|---|
| Safer browser | Firefox + uBlock Origin |
| Suspicious download | Close the tab, discard the file |
| Public Wi-Fi | Enable VPN before connecting |
| ISP DNS | Switch to 1.1.1.1 or 9.9.9.9 in System Settings |
| Add media to library | Drop into `~/Desktop/Media Drop/` |
| Jellyfin web UI | http://10.0.0.225:8096 |
