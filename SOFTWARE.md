# Software

---

## Operating System

| Item | Value |
|---|---|
| OS | Debian GNU/Linux 13 (Trixie) |
| Kernel | 6.18.34+rpt-rpi-v8 |
| Architecture | aarch64 |
| Package manager | apt |

---

## Jellyfin

| Item | Value |
|---|---|
| Version | 10.11.11+deb13 |
| Repository | https://repo.jellyfin.org/debian |
| GPG key | `/usr/share/keyrings/jellyfin.gpg` |
| Repo file | `/etc/apt/sources.list.d/jellyfin.list` |
| Service | `jellyfin.service` |
| Autostart | Enabled |
| Port | 8096 |

### Jellyfin Packages

| Package | Version | Purpose |
|---|---|---|
| jellyfin | 10.11.11+deb13 | Meta-package |
| jellyfin-server | 10.11.11+deb13 | Core server |
| jellyfin-web | 10.11.11+deb13 | Web UI |
| jellyfin-ffmpeg7 | 7.1.4-3-trixie | Transcoding |
| libjemalloc2 | 5.3.0-3 | Memory allocator |

---

## Samba

| Item | Value |
|---|---|
| Version | 4.22.8 |
| Config | `/etc/samba/smb.conf` |
| Config backup | `/etc/samba/smb.conf.backup` |
| Services | `smbd.service`, `nmbd.service` |
| Autostart | Enabled |
| Ports | 445 (SMB), 139 (NetBIOS) |

### Shares

| Share | Path | Access |
|---|---|---|
| `media` | `/srv/media` | sean (read/write) |
| `incoming` | `/srv/media/staging` | sean (read/write) |

### Permission Model

- `force group = jellyfin` — all files created via Samba are owned by the `jellyfin` group
- `create mask = 0664` — new files: `rw-rw-r--`
- `directory mask = 0775` — new directories: `rwxrwxr-x`
- Jellyfin can read and manage all Samba-created files

---

## Active System Services

| Service | Purpose |
|---|---|
| `jellyfin.service` | Jellyfin media server |
| `smbd.service` | Samba file sharing (SMB) |
| `nmbd.service` | Samba NetBIOS name resolution |
| `ssh.service` | SSH remote access |
| `NetworkManager.service` | Network management |
| `avahi-daemon.service` | mDNS — `media-server.local` discovery |
| `cron.service` | Scheduled tasks |

---

## Disabled Services (Previous Projects — Code Preserved)

| Service | Previous Purpose | Code Location |
|---|---|---|
| `panel-os.service` | HUB75 LED panel API (uvicorn, port 8000) | `/home/sean/panel-os/` |
| `stadium-os.service` | Stadium OS Node.js server | `/home/sean/stadium-os/` |

These are disabled but not removed. Intended for future migration to Pi 5 (Sean OS).

---

## OS Package Updates (2026-06-30)

18 packages updated during Phase 1:

| Package | Updated To |
|---|---|
| chromium | 1:149.0.7827.196 |
| chromium-common | 1:149.0.7827.196 |
| chromium-l10n | 1:149.0.7827.196 |
| chromium-sandbox | 1:149.0.7827.196 |
| firefox | 152.0.3 |
| libdtovl0 | 20260626 |
| libgpiolib0 | 20260626 |
| librpieepromab0 | 20260626 |
| librpifwcrypto0 | 20260626 |
| libssh2-1t64 | 1.11.1-1+deb13u1 (security) |
| raspi-utils | 20260626 |
| raspi-utils-core | 20260626 |
| raspi-utils-dt | 20260626 |
| raspi-utils-eeprom | 20260626 |
| raspi-utils-otp | 20260626 |
| raspinfo | 20260626 |
| rpieepromab | 20260626 |
| rpifwcrypto | 20260626 |

---

## Update Procedure

```bash
sudo apt update
apt list --upgradable
sudo apt upgrade -y
# Check if reboot required:
test -f /var/run/reboot-required && echo "REBOOT REQUIRED"
```
