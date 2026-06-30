# Network

---

## Current Configuration

| Item | Value |
|---|---|
| Hostname | `media-server` |
| Primary IP | `10.0.0.225` |
| Secondary IP | `10.0.0.226` |
| Network | `10.0.0.0/24` |
| Connection | Wired Ethernet (preferred, always use wired) |
| Router | `10.0.0.1` |
| SSH | `ssh sean@10.0.0.225` |
| Jellyfin Web UI | `http://10.0.0.225:8096` |
| mDNS | `media-server.local` (via avahi-daemon) |

## IP Address Note

The Pi currently has a DHCP-assigned IP. A static IP assignment is planned to ensure TVs, the Mac, and future Sean OS integration always reach the server at the same address.

**Recommended static IP:** `10.0.0.50` (or another low-conflict address — confirm with router before assigning)

---

## Pending: Static IP Assignment

Options (in order of preference):

1. **Router DHCP reservation** — assign `10.0.0.225` permanently to the Pi's MAC address in the router admin panel. No Pi configuration required. Most reliable.

2. **Pi-side static IP** — configure via NetworkManager on the Pi. Works without router access.

Static IP should be configured before Phase 6 (Sean OS integration) to ensure reliable API access from Pi 5.

---

## Open Ports

| Port | Service | Access |
|---|---|---|
| 22 | SSH | Local network only |
| 8096 | Jellyfin HTTP | Local network only |
| 139 | Samba NetBIOS | Local network only |
| 445 | Samba SMB | Local network only |

## SMB File Shares

Connect from macOS Finder → Go → Connect to Server:

| Share | URL (hostname) | URL (IP) | Contents |
|---|---|---|---|
| Full library | `smb://media-server.local/media` | `smb://10.0.0.225/media` | All media folders |
| Incoming | `smb://media-server.local/incoming` | `smb://10.0.0.225/incoming` | Staging drop zone |

**Credentials:** username `sean`, Samba password (same as Pi login).

### Connecting via Finder

1. Open Finder
2. Press `⌘K` (or Go → Connect to Server)
3. Enter: `smb://media-server.local/media`
4. Click Connect
5. Enter username `sean` and your password
6. Check "Remember this password in my keychain" to avoid future prompts

To mount both shares, repeat with `smb://media-server.local/incoming`.

No ports are exposed to the internet. Remote access has not been configured and is not planned unless explicitly requested.

---

## Client Access

| Client | Access Method |
|---|---|
| Mac | Browser at `http://10.0.0.225:8096` or SSH |
| Android TV (Living Room) | Jellyfin Android TV app — auto-discovery |
| Android TV (Bedroom) | Jellyfin Android TV app — auto-discovery |
| iPhone / iPad | Jellyfin iOS app |
| Sean OS (Pi 5, future) | Jellyfin HTTP API at `http://10.0.0.225:8096` |
