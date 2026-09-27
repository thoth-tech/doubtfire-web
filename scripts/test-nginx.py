#!/usr/bin/env python3
"""Exercise the production Nginx configuration with disposable static fixtures.

Run with `python3 scripts/test-nginx.py`. Docker is required; no app build,
database, external port, or production credentials are used.
"""

import gzip
from http.client import HTTPException
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent


def docker(*arguments):
    return subprocess.check_output(["docker", *arguments], text=True).strip()


class NginxTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.container = None
        cls.fixture = tempfile.TemporaryDirectory(prefix="ontrack-nginx-")
        cls.addClassCleanup(cls.fixture.cleanup)
        cls.files = Path(cls.fixture.name)
        # Linux bind mounts retain mkdtemp's 0700 mode. Nginx workers must be
        # able to traverse this directory of public, synthetic static fixtures.
        cls.files.chmod(0o755)
        (cls.files / "assets").mkdir()
        (cls.files / "index.html").write_text("<!doctype html><title>OnTrack test shell</title>")
        cls.manifest = (ROOT / "src/manifest.webmanifest").read_bytes()
        (cls.files / "manifest.webmanifest").write_bytes(cls.manifest)
        (cls.files / "assets/test.js").write_text("/*" + "asset fixture " * 100 + "*/")
        (cls.files / "assets/test.json").write_text(json.dumps({"message": "fixture " * 100}))
        image = re.search(r"^FROM (nginx:\S+)$", (ROOT / "deploy.Dockerfile").read_text(), re.M)[1]
        cls.container = docker(
            "run", "--rm", "--detach", "--publish", "127.0.0.1::80",
            "--mount", f"type=bind,src={ROOT / 'nginx.conf'},dst=/etc/nginx/nginx.conf,readonly",
            "--mount", f"type=bind,src={cls.files},dst=/usr/share/nginx/html,readonly",
            image,
        )
        cls.addClassCleanup(lambda: docker("rm", "--force", cls.container))
        docker("exec", cls.container, "nginx", "-t")
        cls.base = "http://" + docker("port", cls.container, "80/tcp")
        for _ in range(50):
            try:
                cls.request("/")
                break
            except (URLError, ConnectionError, TimeoutError, HTTPException):
                # Docker can publish the port before the Nginx worker is ready,
                # including a reset after TCP connects but before HTTP headers.
                time.sleep(0.1)
        else:
            raise RuntimeError("Nginx did not become ready")

    @classmethod
    def request(cls, path, **headers):
        try:
            response = urlopen(Request(cls.base + path, headers=headers), timeout=5)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.headers, response.read()

    def test_manifest_type_and_compression_preserve_other_mime_types(self):
        status, headers, body = self.request("/manifest.webmanifest", **{"Accept-Encoding": "gzip"})
        self.assertEqual(200, status)
        self.assertEqual("application/manifest+json", headers.get_content_type())
        self.assertEqual("gzip", headers.get("Content-Encoding"))
        self.assertEqual(self.manifest, gzip.decompress(body))
        for path, expected_type in [("/assets/test.js", "application/javascript"),
                                    ("/assets/test.json", "application/json")]:
            with self.subTest(path=path):
                status, headers, body = self.request(path, **{"Accept-Encoding": "gzip"})
                self.assertEqual(200, status)
                self.assertEqual(expected_type, headers.get_content_type())
                self.assertEqual("gzip", headers.get("Content-Encoding"))
                self.assertEqual((self.files / path.lstrip("/")).read_bytes(), gzip.decompress(body))

    def test_missing_assets_and_control_files_return_real_404s(self):
        for path in ["/assets/missing.js", "/assets/nested/missing.css", "/ngsw.json",
                     "/ngsw-worker.js", "/safety-worker.js", "/worker-basic.min.js"]:
            with self.subTest(path=path):
                status, headers, body = self.request(path)
                self.assertEqual(404, status)
                self.assertNotIn(b"OnTrack test shell", body)
                self.assertIn("default-src", headers["Content-Security-Policy"])
        manifest = self.files / "manifest.webmanifest"
        manifest.unlink()
        try:
            self.assertEqual(404, self.request("/manifest.webmanifest")[0])
        finally:
            manifest.write_bytes(self.manifest)

    def test_deep_routes_keep_the_uncached_application_shell(self):
        for path in ["/", "/projects/42/tasks/13", "/projects/42/tasks/13?refresh=1"]:
            with self.subTest(path=path):
                status, headers, body = self.request(path)
                self.assertEqual(200, status)
                self.assertIn(b"OnTrack test shell", body)
                self.assertIn("no-store", headers["Cache-Control"])

    def test_auto_workers_use_available_processors(self):
        processes = docker("exec", self.container, "ps", "-o", "args")
        workers = sum(line.startswith("nginx: worker process") for line in processes.splitlines())
        processors = int(docker("exec", self.container, "getconf", "_NPROCESSORS_ONLN"))
        self.assertEqual(processors, workers)
        print(f"Nginx started {workers} workers for {processors} available processors")


if __name__ == "__main__":
    unittest.main()
