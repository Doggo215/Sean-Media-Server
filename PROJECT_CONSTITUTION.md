# Sean Media Server — Project Constitution

## Mission

Build a dedicated Raspberry Pi 4 home media server using Jellyfin.

This Pi is responsible only for serving movies and TV shows.

It is NOT responsible for AI, automation, LED panels, sports, lighting, projector control, voice assistants, or Sean OS.

Those responsibilities belong to the Raspberry Pi 5.

The Media Server must remain fully functional even if Sean OS is offline.

---

## Primary Goals

Create a fast, reliable, family-friendly home streaming server that allows:

- Uploading movies and TV shows
- Automatic media organization
- Automatic artwork and metadata download
- Resume playback and watched history
- Streaming to multiple televisions
- Streaming to Android TV
- Future storage expansion

Everything should feel like a private streaming service.

---

## Infrastructure First (Mandatory)

Before installing or changing anything, always verify the machine is healthy.

Every development session begins with:

- Verify Raspberry Pi boots successfully
- Verify storage health
- Verify networking and Ethernet status
- Verify hostname and IP address
- Verify SSH
- Verify system services
- Verify available disk space
- Verify package status

Never assume a reinstall is necessary. Inspect the existing system first.

---

## Operating System Decision

**Chosen: Raspberry Pi OS (Debian 13 Trixie) + Jellyfin**

Rationale:
- Official hardware support — kernel, GPU drivers, firmware maintained by Pi Foundation
- Headless compatible — no desktop environment required for server operation
- Jellyfin publishes official Debian packages with hardware acceleration tested against this OS
- Maximum flexibility for Sean OS integration
- Standard Debian packaging — `apt upgrade` keeps everything current
- Largest community support base for Pi projects

---

## Development Philosophy

- Reliability before features
- Incremental development — one logical change at a time
- Explain the plan before major changes
- Always test before continuing
- Never guess — ask if information is missing
- Choose maintainability over cleverness

---

## Mandatory Rules

- Never make multiple major changes simultaneously
- Never overwrite working functionality
- Never install unnecessary software
- Prefer official Jellyfin features over third-party plugins
- Never delete media automatically
- Never reorganize media without approval
- Preserve metadata whenever possible
- Preserve watched history, users, and configuration
- Document every completed milestone

---

## Scalability Requirement

Build this project as if it will eventually contain:

- Thousands of movies
- Thousands of TV episodes
- Multiple users
- Multiple Android TVs
- Future storage upgrades
- Future server migrations

No future storage upgrade should require rebuilding the library.

---

## Security

- Remain local-network only unless remote access is explicitly requested
- Protect administrator access
- Never expose credentials
- Never commit secrets to GitHub

---

## GitHub Workflow

- Never begin work with a dirty repository
- Check git status before starting
- Commit tested, verified changes only
- Push verified work
- Use meaningful commit messages
- Update documentation whenever architecture changes

---

## Storage Rules

- Treat media as permanent
- Never format storage without approval
- Never move media automatically
- Future storage migrations must preserve movies, TV, metadata, artwork, users, watch history, and configuration
- No rebuilds during storage migration

---

## Sean OS Integration Philosophy

Sean OS may control Jellyfin.
Sean OS may monitor playback.
Sean OS may automate lighting based on playback.
Sean OS may launch movies via voice or automation.

Jellyfin must never depend on Sean OS.
If Sean OS is offline, the Media Server must continue operating normally.
Maintain loose coupling between both systems at all times.

---

## Project Philosophy

Build the Media Server first. Perfect it. Then integrate with Sean OS.

Every architectural decision should prioritize long-term stability, scalability, maintainability, and simplicity over adding features quickly.

The objective is a permanent home media platform that grows for years without requiring a complete redesign.
