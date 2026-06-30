# Hardware

---

## Raspberry Pi 4

| Item | Value |
|---|---|
| Model | Raspberry Pi 4 Model B Rev 1.5 |
| CPU | Broadcom BCM2711, Quad-core Cortex-A72 (ARM v8) 64-bit @ 1.8GHz |
| RAM | 1.8GB LPDDR4-3200 |
| Storage | 64GB microSD (boot + OS) |
| Network | Gigabit Ethernet (wired, preferred) |
| USB | 2× USB 3.0, 2× USB 2.0 |
| Video | 2× micro HDMI |
| Power | USB-C 5V 3A |
| OS | Debian GNU/Linux 13 (Trixie) |
| Kernel | 6.18.34+rpt-rpi-v8 (aarch64) |

---

## Current Peripherals

| Item | Status |
|---|---|
| Ethernet cable | Connected |
| Power supply | Connected |
| microSD card | 64GB — boot device |
| Monitor/keyboard | Connected (used for initial setup only) |

---

## Planned Hardware

| Item | Purpose | Status |
|---|---|---|
| 4TB USB hard drive | Permanent media storage | Planned |

### 4TB Drive Notes

- Connect via USB 3.0 port (blue ports)
- Use a drive with its own power supply if possible (avoids USB power draw issues)
- Recommended format: ext4
- Will mount at `/srv/media/` replacing SD card media storage
- No Jellyfin reconfiguration required after migration

---

## Hardware Acceleration

The Pi 4's VideoCore VI GPU supports V4L2 hardware-accelerated video decoding.

This can be enabled in Jellyfin to offload H.264 and H.265 decoding from the CPU, enabling smooth 1080p transcoding.

Hardware acceleration configuration is planned for Phase 3B (Optimization).

**Supported codecs on Pi 4 via V4L2:**
- H.264 (decode)
- H.265/HEVC (decode, Pi 4 limited)
- VP8 (decode)
- VP9 (decode, limited)
