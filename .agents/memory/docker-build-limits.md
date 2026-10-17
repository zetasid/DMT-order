---
name: Docker build limits in this Replit runner
description: The runner exposes Docker CLI tools but does not provide a usable BuildKit environment.
---

This workspace does not have a usable Docker BuildKit runner. The Docker CLI and daemon binaries are present, and a temporary daemon can start in an unprivileged user namespace with networking disabled. BuildKit still fails to mount build layers with `operation not permitted`; a container-backed Buildx builder also fails during UID/GID extraction. Compose syntax validation can pass without exercising any Dockerfile build.

**Why:** CLI presence and a valid Compose file can look like a working build setup, but neither confirms that the images can be built.

**How to apply:** For Docker work in this runner, distinguish Compose validation from image-build verification. Use a working Docker host or CI builder for amd64/arm64 builds, and report the build as unverified until that run succeeds.
