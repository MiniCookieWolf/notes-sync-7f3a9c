import functools
import http.server
import os
import socket
import socketserver
import sys

DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
PORT = 4173


def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def print_banner(url: str):
    print("\n" + "=" * 64)
    print("   UKMPPD ACTIVE MASTERY — SERVER ANDROID PWA AKTIF!")
    print("=" * 64)
    print(f"\n  Buka di Chrome HP Android (pastikan 1 Wi-Fi dengan PC ini):")
    print(f"  >>>  {url}  <<<\n")
    print("  Cara Install jadi Aplikasi Android:")
    print("  1. Buka link di atas pakai Google Chrome di HP Android")
    print("  2. Ketuk menu titik tiga (⋮) -> 'Install app' / 'Tambahkan ke layar utama'")
    print("  3. Masuk tab 'Statistik' -> tap 'Simpan Semua Data Offline Sekarang'")
    print("     agar semua bank soal & gambar bisa dibuka kapan saja tanpa kuota!\n")
    print("  Tekan Ctrl+C di jendela ini untuk menghentikan server.")
    print("=" * 64 + "\n")


class SpaHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.endswith("sw.js") or self.path.endswith("manifest.webmanifest"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        clean_path = self.path.split("?")[0].lstrip("/")
        full_path = os.path.join(DIST_DIR, clean_path)
        if clean_path and not os.path.exists(full_path):
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, format, *args):
        # Keep console clean; only log errors
        if args and len(args) >= 2 and str(args[1]).startswith(("4", "5")):
            super().log_message(format, *args)


def main():
    if not os.path.exists(os.path.join(DIST_DIR, "index.html")):
        print("ERROR: Folder dist/ belum ada. Jalankan `npm run build` terlebih dahulu.")
        sys.exit(1)

    lan_ip = get_lan_ip()
    url = f"http://{lan_ip}:{PORT}"
    print_banner(url)

    handler = functools.partial(SpaHandler, directory=DIST_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer dihentikan.")


if __name__ == "__main__":
    main()
