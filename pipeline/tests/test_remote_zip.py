import io
import re
import threading
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from boligmaskinen_pipeline import remote_zip


def archive() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zipped:
        zipped.writestr("noise/eu_2022_vej_4m.shp", b"shape" * 1000)
        zipped.writestr("noise/eu_2022_vej_4m.dbf", b"table")
        zipped.writestr("noise/eu_2022_jernbane.shp", b"rail")
    return buffer.getvalue()


@pytest.fixture
def server():
    """A file server that answers byte ranges, as files-miljoegis.mim.dk does; or ignores them."""
    data = archive()
    requests: list[str | None] = []

    class Handler(BaseHTTPRequestHandler):
        ranges = True

        def do_HEAD(self):
            self.send_response(200)
            if self.ranges:
                self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()

        def do_GET(self):
            requests.append(self.headers.get("Range"))
            match = re.fullmatch(r"bytes=(\d+)-(\d+)", self.headers.get("Range") or "")
            if not match or not self.ranges:
                self.send_response(200)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            start, end = int(match[1]), int(match[2])
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{len(data)}")
            self.send_header("Content-Length", str(end - start + 1))
            self.end_headers()
            self.wfile.write(data[start:end + 1])

        def log_message(self, *args):
            pass

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_port}/2022_noise_shp.zip", Handler, requests
    httpd.shutdown()


def test_extracts_only_the_members_asked_for(server, tmp_path):
    url, _, requests = server
    remote_zip.cli(["extract", url, r"^(.*/)?eu_2022_vej_4m\.(shp|dbf)$", str(tmp_path / "out")])
    assert sorted(path.name for path in (tmp_path / "out").iterdir()) == ["eu_2022_vej_4m.dbf", "eu_2022_vej_4m.shp"]
    assert (tmp_path / "out" / "eu_2022_vej_4m.shp").read_bytes() == b"shape" * 1000
    assert all(r and r.startswith("bytes=") for r in requests)


def test_lists_the_members(server, capsys):
    url, _, _ = server
    remote_zip.cli(["list", url])
    assert "noise/eu_2022_jernbane.shp" in capsys.readouterr().out


def test_says_when_nothing_matches_or_ranges_are_ignored(server, tmp_path):
    url, handler, _ = server
    with pytest.raises(SystemExit, match="No member of the archive matches"):
        remote_zip.cli(["extract", url, r"\.gpkg$", str(tmp_path / "out")])
    handler.ranges = False
    with pytest.raises(RuntimeError, match="does not advertise byte ranges"):
        remote_zip.cli(["list", url])
