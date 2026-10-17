#!/usr/bin/env python3
"""Verify Linux platforms in an OCI image-layout archive."""

from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import re
import sys
import tarfile
from typing import Any

REQUIRED_PLATFORMS = frozenset({("linux", "amd64"), ("linux", "arm64")})
OCI_INDEX_MEDIA_TYPE = "application/vnd.oci.image.index.v1+json"
DOCKER_INDEX_MEDIA_TYPE = "application/vnd.docker.distribution.manifest.list.v2+json"
BUILDKIT_REFERENCE_TYPE_ANNOTATION = "vnd.docker.reference.type"
BUILDKIT_ATTESTATION_MANIFEST = "attestation-manifest"


class OCIValidationError(ValueError):
    """Raised when an OCI archive is invalid or lacks required platforms."""


def _json_bytes(data: bytes, source: str) -> dict[str, Any]:
    try:
        value = json.loads(data)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise OCIValidationError(f"{source} is not valid JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise OCIValidationError(f"{source} must contain a JSON object")
    return value


def _member_map(archive: tarfile.TarFile) -> dict[str, tarfile.TarInfo]:
    members: dict[str, tarfile.TarInfo] = {}
    for member in archive.getmembers():
        normalized = posixpath.normpath(member.name)
        if normalized == "." or normalized.startswith("../") or normalized.startswith("/"):
            continue
        members[normalized] = member
    return members


def _read_member(
    archive: tarfile.TarFile,
    members: dict[str, tarfile.TarInfo],
    name: str,
) -> bytes:
    member = members.get(name)
    if member is None or not member.isfile():
        raise OCIValidationError(f"OCI archive is missing regular file {name}")
    stream = archive.extractfile(member)
    if stream is None:
        raise OCIValidationError(f"Could not read {name} from OCI archive")
    with stream:
        return stream.read()


def _read_blob(
    archive: tarfile.TarFile,
    members: dict[str, tarfile.TarInfo],
    digest: str,
) -> bytes:
    match = re.fullmatch(r"sha256:([0-9a-f]{64})", digest)
    if match is None:
        raise OCIValidationError(f"Unsupported or malformed OCI digest: {digest}")
    encoded = match.group(1)
    blob = _read_member(archive, members, f"blobs/sha256/{encoded}")
    if hashlib.sha256(blob).hexdigest() != encoded:
        raise OCIValidationError(f"Digest mismatch for OCI blob {digest}")
    return blob


def _is_artifact_manifest(descriptor: dict[str, Any], document: dict[str, Any]) -> bool:
    """Return whether a manifest is an OCI artifact rather than a runnable image."""
    if "artifactType" in document or "subject" in document:
        return True

    # BuildKit marks attestation descriptors this way. Their config is often
    # the empty JSON object, not a runtime image config with os/architecture.
    annotations = descriptor.get("annotations")
    return (
        isinstance(annotations, dict)
        and annotations.get(BUILDKIT_REFERENCE_TYPE_ANNOTATION)
        == BUILDKIT_ATTESTATION_MANIFEST
    )


def read_oci_platforms(archive_path: str) -> set[tuple[str, str]]:
    """Read actual image platforms, following nested indexes and image configs."""
    try:
        archive = tarfile.open(archive_path, mode="r:*")
    except (OSError, tarfile.TarError) as exc:
        raise OCIValidationError(f"Cannot open OCI archive: {exc}") from exc

    platforms: set[tuple[str, str]] = set()
    visited_indexes: set[str] = set()

    with archive:
        members = _member_map(archive)
        root = _json_bytes(_read_member(archive, members, "index.json"), "index.json")
        if root.get("schemaVersion") != 2:
            raise OCIValidationError("index.json must use schemaVersion 2")
        root_descriptors = root.get("manifests")
        if not isinstance(root_descriptors, list) or not root_descriptors:
            raise OCIValidationError("index.json has no manifest descriptors")

        def visit(descriptor: dict[str, Any]) -> None:
            digest = descriptor.get("digest")
            if not isinstance(digest, str):
                raise OCIValidationError("OCI descriptor is missing its digest")
            document = _json_bytes(_read_blob(archive, members, digest), digest)

            children = document.get("manifests")
            if isinstance(children, list):
                if digest in visited_indexes:
                    return
                visited_indexes.add(digest)
                if document.get("schemaVersion") != 2:
                    raise OCIValidationError(f"Nested index {digest} must use schemaVersion 2")
                for child in children:
                    if not isinstance(child, dict):
                        raise OCIValidationError(f"Nested index {digest} contains an invalid descriptor")
                    visit(child)
                return

            # Handle artifact markers before interpreting the config as an
            # image config. BuildKit attestation configs do not declare a
            # runtime platform.
            if _is_artifact_manifest(descriptor, document):
                return

            config_descriptor = document.get("config")
            if isinstance(config_descriptor, dict):
                config_digest = config_descriptor.get("digest")
                if not isinstance(config_digest, str):
                    raise OCIValidationError(f"Image manifest {digest} has no config digest")
                config = _json_bytes(
                    _read_blob(archive, members, config_digest),
                    config_digest,
                )
                os_name = config.get("os")
                architecture = config.get("architecture")
                if not isinstance(os_name, str) or not isinstance(architecture, str):
                    raise OCIValidationError(
                        f"Image config {config_digest} is missing os or architecture"
                    )

                declared = descriptor.get("platform")
                if isinstance(declared, dict):
                    declared_os = declared.get("os")
                    declared_arch = declared.get("architecture")
                    if (
                        declared_os is not None
                        and declared_arch is not None
                        and (declared_os, declared_arch) != (os_name, architecture)
                    ):
                        raise OCIValidationError(
                            f"Descriptor platform {declared_os}/{declared_arch} "
                            f"does not match image config {os_name}/{architecture}"
                        )
                platforms.add((os_name, architecture))
                return

            media_type = descriptor.get("mediaType", "")
            if media_type in (OCI_INDEX_MEDIA_TYPE, DOCKER_INDEX_MEDIA_TYPE):
                raise OCIValidationError(f"Index descriptor {digest} has no manifests")
            raise OCIValidationError(
                f"Referenced OCI object {digest} is neither an image index nor an image manifest"
            )

        for descriptor in root_descriptors:
            if not isinstance(descriptor, dict):
                raise OCIValidationError("index.json contains an invalid manifest descriptor")
            visit(descriptor)

    return platforms


def validate_required_platforms(platforms: set[tuple[str, str]]) -> None:
    missing = REQUIRED_PLATFORMS - platforms
    if missing:
        missing_text = ", ".join(f"{os_name}/{arch}" for os_name, arch in sorted(missing))
        found_text = ", ".join(f"{os_name}/{arch}" for os_name, arch in sorted(platforms)) or "none"
        raise OCIValidationError(
            f"Missing required platform(s): {missing_text}; found: {found_text}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", help="Buildx OCI archive to inspect")
    parser.add_argument("--target", required=True, help="Image target label for CI output")
    args = parser.parse_args()

    try:
        platforms = read_oci_platforms(args.archive)
        print(f"OCI platforms for {args.target}:")
        for os_name, architecture in sorted(platforms):
            print(f"{os_name}/{architecture}")
        validate_required_platforms(platforms)
    except OCIValidationError as exc:
        print(f"OCI verification failed: {exc}", file=sys.stderr)
        return 1

    print(f"Verified required platforms for {args.target}: linux/amd64, linux/arm64")
    return 0


if __name__ == "__main__":
    sys.exit(main())
