# Network

---

## Current Configuration

| Item | Value |
|---|---|
| Hostname | `media-server` |
| Primary IP | `10.0.0.226` (DHCP reserved — permanent) |
| Network | `10.0.0.0/24` |
| Connection | Wired Ethernet |
| Router | `10.0.0.1` |
| SSH | `ssh sean@10.0.0.226` |
| Jellyfin Web UI | `http://10.0.0.226:8096` |
| mDNS | `media-server.local` (via avahi-daemon) |
| GitHub | https://github.com/Doggo215/Sean-Media-Server |

---

## Static IP — DHCP Reservation

The IP address `10.0.0.226` is permanently reserved for this Pi via a DHCP reservation at the router.

**The IP is not hardcoded on the Pi.** Networking is centrally managed by the router. If the Pi is ever replaced:
1. Log into http://10.0.0.1
2. Go to DHCP → Static Leases (or DHCP Reservations)
3. Find `media-server` and update the MAC address to the new Pi's MAC
4. The IP `10.0.0.226` will continue to be assigned automatically

To find the Pi's MAC address:
```bash
ssh sean@10.0.0.226 "ip link show eth0 | grep link/ether"
```

---

## Open Ports

| Port | Service | Access |
|---|---|---|
| 22 | SSH | Local network only |
| 8096 | Jellyfin HTTP | Local network only |
| 139 | Samba NetBIOS | Local network only |
| 445 | Samba SMB | Local network only |

No ports are exposed to the internet. Remote access has not been configured and is not planned unless explicitly requested.

---

## SMB File Shares

Connect from macOS Finder → Go → Connect to Server:

| Share | URL (hostname) | URL (IP) | Contents |
|---|---|---|---|
| Full library | `smb://media-server.local/media` | `smb://10.0.0.226/media` | All media folders |
| Incoming | `smb://media-server.local/incoming` | `smb://10.0.0.226/incoming` | Staging drop zone |

**Credentials:** username `sean`, Samba password (same as Pi login).

### Connecting via Finder

1. Open Finder
2. Press `⌘K` (or Go → Connect to Server)
3. Enter: `smb://media-server.local/media`
4. Click Connect
5. Enter username `sean` and your password
6. Check "Remember this password in my keychain" to avoid future prompts

To mount both shares, repeat with `smb://media-server.local/incoming`.

---

## Client Access

| Client | Access Method |
|---|---|
| Mac | Browser at `http://10.0.0.226:8096` or SSH |
| Android TV (Living Room) | Jellyfin Android TV app — auto-discovery |
| Android TV (Bedroom) | Jellyfin Android TV app — auto-discovery |
| iPhone / iPad | Jellyfin iOS app |
| Sean OS (Pi 5, future) | Jellyfin HTTP API at `http://10.0.0.226:8096` |
