# UKMPPD Active Mastery — Panduan GitHub Deploy & Auto-Update Android

Folder `ukmppd-app` ini sudah siap di-push ke GitHub dan mendukung **2 jalur install Android** sekaligus dengan **auto-update** setiap kali Anda melakukan `git push` ke branch `main`:

1. **GitHub Actions APK Builder (Cocok untuk Repo Private!)**
   - Setiap kali Anda push ke `main`, workflow `.github/workflows/build-apk.yml` otomatis meng-compile file **`app-debug.apk`** (berisi seluruh 4.460 soal + 961 flashcard + 460 gambar tertanam 100% offline).
   - Cara download APK: buka repo di GitHub → tab **Actions** → pilih run terbaru **Build Android APK (Capacitor)** → scroll ke bawah ke bagian **Artifacts** → download **`UKMPPD-Active-Mastery-APK`** → ekstrak & install di HP Android!

2. **GitHub Pages HTTPS PWA (Auto-Update Tanpa Install Ulang APK)**
   - Workflow `.github/workflows/deploy-pages.yml` otomatis men-deploy versi web HTTPS (`https://<username>.github.io/<nama-repo>/`).
   - Cara aktifkan sekali di GitHub: **Settings → Pages → Build and deployment → Source: pilih `GitHub Actions`**.
   - Buka link GitHub Pages di **Google Chrome HP Android** → ketuk menu titik tiga (**⋮**) → **Install app / Tambahkan ke layar utama** → masuk tab **Statistik** → tap **Simpan Semua Data Offline Sekarang**.
   - Setiap Anda `git push` soal baru, PWA di HP otomatis memperbarui dirinya saat dibuka kembali!

## Cara Push ke GitHub (Dari Terminal di `e:\AntigravityMainFolder\ukmppd-app`)
```powershell
git remote add origin https://github.com/<USERNAME>/<NAMA-REPO>.git
git push -u origin main
```
