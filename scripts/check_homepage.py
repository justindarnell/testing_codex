import contextlib
import http.server
import socket
import threading
import time
import urllib.request

ROOT_DIR = "."


def find_free_port() -> int:
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.bind(("", 0))
        return sock.getsockname()[1]


def run_server(port: int) -> http.server.ThreadingHTTPServer:
    handler = http.server.SimpleHTTPRequestHandler
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def fetch_homepage(port: int) -> str:
    url = f"http://127.0.0.1:{port}/"
    with urllib.request.urlopen(url, timeout=5) as response:
        if response.status != 200:
            raise RuntimeError(f"Unexpected status: {response.status}")
        return response.read().decode("utf-8")


def main() -> None:
    port = find_free_port()
    httpd = run_server(port)
    try:
        time.sleep(0.2)
        html = fetch_homepage(port)
        if "LlamaSim" not in html:
            raise RuntimeError("Homepage did not include expected LlamaSim content")
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
