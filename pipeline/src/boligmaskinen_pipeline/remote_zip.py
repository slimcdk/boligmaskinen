"""List or extract members of a remote ZIP file using HTTP range requests.

Avoids downloading multi-gigabyte archives when only a few members are needed.

Usage:
    python -m boligmaskinen_pipeline remote-zip list <url>
    python -m boligmaskinen_pipeline remote-zip extract <url> <regex> <out_dir>
"""

import io
import re
import zipfile
from pathlib import Path

import httpx

from .progress import log


class HttpRangeFile(io.RawIOBase):
    """Seekable, read-only file object backed by HTTP range requests."""

    def __init__(self, url: str, client: httpx.Client):
        self.url = url
        self.client = client
        head = client.head(url, follow_redirects=True)
        head.raise_for_status()
        if head.headers.get("accept-ranges", "").lower() != "bytes":
            raise RuntimeError("Server does not advertise byte ranges")
        self.size = int(head.headers["content-length"])
        self.pos = 0

    def seekable(self) -> bool:
        return True

    def readable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        if whence == io.SEEK_SET:
            self.pos = offset
        elif whence == io.SEEK_CUR:
            self.pos += offset
        elif whence == io.SEEK_END:
            self.pos = self.size + offset
        return self.pos

    def read(self, n: int = -1) -> bytes:
        if self.pos >= self.size:
            return b""
        end = self.size - 1 if n is None or n < 0 else min(self.size, self.pos + n) - 1
        response = self.client.get(self.url, headers={"Range": f"bytes={self.pos}-{end}"})
        response.raise_for_status()
        if response.status_code != 206:
            raise RuntimeError(f"The server ignored the byte range and answered {response.status_code}")
        data = response.content
        self.pos += len(data)
        return data

    def readinto(self, buffer) -> int:
        data = self.read(len(buffer))
        buffer[: len(data)] = data
        return len(data)


def cli(argv: list[str]) -> None:
    if len(argv) < 2 or argv[0] not in ("list", "extract") or (argv[0] == "extract" and len(argv) != 4):
        raise SystemExit(__doc__)
    command, url = argv[0], argv[1]
    with httpx.Client(timeout=120, follow_redirects=True) as client:
        remote = io.BufferedReader(HttpRangeFile(url, client), buffer_size=1 << 20)
        with zipfile.ZipFile(remote) as archive:
            if command == "list":
                for info in archive.infolist():
                    log(f"{info.file_size:>14,}  {info.filename}")
                return
            pattern, out_dir = re.compile(argv[2]), Path(argv[3])
            out_dir.mkdir(parents=True, exist_ok=True)
            found = 0
            for info in archive.infolist():
                if info.is_dir() or not pattern.search(info.filename):
                    continue
                target = out_dir / Path(info.filename).name
                with archive.open(info) as source, open(target, "wb") as sink:
                    while chunk := source.read(1 << 20):
                        sink.write(chunk)
                found += 1
                log(f"Extracted {info.filename} ({info.file_size:,} bytes)")
            if not found:
                raise SystemExit(f"No member of the archive matches {argv[2]}")
