import hashlib
import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path

from verify_oci_platforms import (
    OCIValidationError,
    read_oci_platforms,
    validate_required_platforms,
)

OCI_INDEX = "application/vnd.oci.image.index.v1+json"
OCI_MANIFEST = "application/vnd.oci.image.manifest.v1+json"
OCI_CONFIG = "application/vnd.oci.image.config.v1+json"


def _blob(data: bytes) -> tuple[str, str]:
    digest = f"sha256:{hashlib.sha256(data).hexdigest()}"
    return digest, f"blobs/sha256/{digest.split(':', 1)[1]}"


def _json_blob(value: dict) -> tuple[dict, tuple[str, bytes]]:
    data = json.dumps(value, separators=(",", ":"), sort_keys=True).encode()
    digest, path = _blob(data)
    return (
        {"mediaType": value.get("mediaType"), "digest": digest, "size": len(data)},
        (path, data),
    )


def _image(architecture: str) -> tuple[dict, list[tuple[str, bytes]]]:
    config = {
        "architecture": architecture,
        "os": "linux",
        "config": {},
        "rootfs": {"type": "layers", "diff_ids": []},
        "history": [],
    }
    config_data = json.dumps(config, separators=(",", ":"), sort_keys=True).encode()
    config_digest, config_path = _blob(config_data)
    manifest = {
        "schemaVersion": 2,
        "mediaType": OCI_MANIFEST,
        "config": {
            "mediaType": OCI_CONFIG,
            "digest": config_digest,
            "size": len(config_data),
        },
        "layers": [],
    }
    descriptor, manifest_blob = _json_blob(manifest)
    descriptor["platform"] = {"os": "linux", "architecture": architecture}
    return descriptor, [(config_path, config_data), manifest_blob]


def _write_archive(path: Path, nested: bool, architectures: tuple[str, ...]) -> None:
    blobs: list[tuple[str, bytes]] = []
    image_descriptors = []
    for architecture in architectures:
        descriptor, image_blobs = _image(architecture)
        image_descriptors.append(descriptor)
        blobs.extend(image_blobs)

    root_descriptors = image_descriptors
    if nested:
        nested_index = {
            "schemaVersion": 2,
            "mediaType": OCI_INDEX,
            "manifests": image_descriptors,
        }
        nested_descriptor, nested_blob = _json_blob(nested_index)
        nested_descriptor["mediaType"] = OCI_INDEX
        # Deliberately omit a platform here: architectures are in the referenced index.
        root_descriptors = [nested_descriptor]
        blobs.append(nested_blob)

    root_index = {
        "schemaVersion": 2,
        "mediaType": OCI_INDEX,
        "manifests": root_descriptors,
    }
    entries = [
        ("oci-layout", b'{"imageLayoutVersion":"1.0.0"}'),
        ("index.json", json.dumps(root_index, separators=(",", ":")).encode()),
        *blobs,
    ]
    with tarfile.open(path, mode="w") as archive:
        for name, data in entries:
            info = tarfile.TarInfo(name)
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))


class VerifyOCIPlatformsTests(unittest.TestCase):
    def test_follows_nested_index_without_root_platform_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "nested.oci.tar"
            _write_archive(archive, nested=True, architectures=("amd64", "arm64"))

            platforms = read_oci_platforms(str(archive))

        self.assertEqual(platforms, {("linux", "amd64"), ("linux", "arm64")})
        validate_required_platforms(platforms)

    def test_accepts_platform_manifests_at_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "root.oci.tar"
            _write_archive(archive, nested=False, architectures=("amd64", "arm64"))

            platforms = read_oci_platforms(str(archive))

        self.assertEqual(platforms, {("linux", "amd64"), ("linux", "arm64")})
        validate_required_platforms(platforms)

    def test_rejects_archive_missing_arm64(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "amd64-only.oci.tar"
            _write_archive(archive, nested=True, architectures=("amd64",))

            platforms = read_oci_platforms(str(archive))

        with self.assertRaisesRegex(OCIValidationError, "linux/arm64"):
            validate_required_platforms(platforms)


if __name__ == "__main__":
    unittest.main()
