"""
File utility functions.
"""

import hashlib


def get_file_hash(file_path: str) -> str:
    """
    Calculate MD5 hash of a file's content.

    This is used for duplicate detection - if we've already processed
    a file with the same hash, we can skip it.

    Args:
        file_path: Path to the file.

    Returns:
        MD5 hash as a hex string.
    """
    md5 = hashlib.md5()

    with open(file_path, "rb") as f:
        # Read in chunks to handle large files
        for chunk in iter(lambda: f.read(8192), b""):
            md5.update(chunk)

    return md5.hexdigest()
