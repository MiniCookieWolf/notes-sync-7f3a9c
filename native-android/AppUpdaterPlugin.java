package com.studypro.notesync;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean isDownloading = false;

    private HttpURLConnection openWithRedirects(String urlStr) throws Exception {
        String current = urlStr;
        for (int i = 0; i < 8; i++) {
            URL url = new URL(current);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "StudyPro-Updater");
            conn.connect();
            int code = conn.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String loc = conn.getHeaderField("Location");
                conn.disconnect();
                if (loc == null || loc.isEmpty()) {
                    throw new Exception("Redirect tanpa Location header");
                }
                if (!loc.startsWith("http")) {
                    URL base = new URL(current);
                    loc = new URL(base, loc).toString();
                }
                current = loc;
                continue;
            }
            return conn;
        }
        throw new Exception("Terlalu banyak redirect");
    }

    @PluginMethod
    public void checkLatestVersion(PluginCall call) {
        String urlStr = call.getString("url");
        if (urlStr == null || urlStr.isEmpty()) {
            call.reject("URL kosong");
            return;
        }
        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                conn = openWithRedirects(urlStr);
                int code = conn.getResponseCode();
                InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                if (is != null) {
                    byte[] buf = new byte[4096];
                    int r;
                    while ((r = is.read(buf)) != -1) {
                        baos.write(buf, 0, r);
                    }
                    is.close();
                }
                JSObject ret = new JSObject();
                ret.put("status", code);
                ret.put("raw", baos.toString(StandardCharsets.UTF_8.name()));
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Gagal cek versi: " + e.getMessage(), e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String urlStr = call.getString("url");
        if (urlStr == null || urlStr.isEmpty()) {
            call.reject("URL APK kosong");
            return;
        }
        if (isDownloading) {
            call.reject("Proses unduhan sedang berjalan");
            return;
        }
        isDownloading = true;
        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                File updatesDir = new File(getContext().getCacheDir(), "updates");
                if (!updatesDir.exists()) {
                    updatesDir.mkdirs();
                }
                File apkFile = new File(updatesDir, "update.apk");
                if (apkFile.exists()) {
                    apkFile.delete();
                }

                conn = openWithRedirects(urlStr);
                int code = conn.getResponseCode();
                if (code < 200 || code >= 300) {
                    call.reject("Gagal unduh APK (HTTP " + code + ")");
                    return;
                }

                long totalBytes = conn.getContentLengthLong();
                long downloadedBytes = 0;
                long lastEmit = 0;

                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream out = new FileOutputStream(apkFile)) {
                    byte[] buf = new byte[16384];
                    int read;
                    while ((read = in.read(buf)) != -1) {
                        out.write(buf, 0, read);
                        downloadedBytes += read;
                        long now = System.currentTimeMillis();
                        if (now - lastEmit >= 200) {
                            lastEmit = now;
                            emitProgress(downloadedBytes, totalBytes);
                        }
                    }
                    out.flush();
                }

                emitProgress(downloadedBytes, totalBytes > 0 ? totalBytes : downloadedBytes);
                launchInstaller(apkFile, call);
            } catch (Exception e) {
                call.reject("Gagal mengunduh APK: " + e.getMessage(), e);
            } finally {
                isDownloading = false;
                if (conn != null) conn.disconnect();
            }
        });
    }

    @PluginMethod
    public void installCachedApk(PluginCall call) {
        File apkFile = new File(new File(getContext().getCacheDir(), "updates"), "update.apk");
        if (!apkFile.exists() || apkFile.length() < 1024) {
            call.reject("File APK update tidak ditemukan di cache");
            return;
        }
        launchInstaller(apkFile, call);
    }

    private void emitProgress(long downloadedBytes, long totalBytes) {
        int pct = totalBytes > 0 ? (int) Math.min(100, Math.round((downloadedBytes * 100.0) / totalBytes)) : 0;
        double dlMb = Math.round((downloadedBytes / (1024.0 * 1024.0)) * 10.0) / 10.0;
        double totMb = totalBytes > 0 ? Math.round((totalBytes / (1024.0 * 1024.0)) * 10.0) / 10.0 : 0.0;
        JSObject prog = new JSObject();
        prog.put("percent", pct);
        prog.put("downloadedMb", dlMb);
        prog.put("totalMb", totMb);
        notifyListeners("downloadProgress", prog);
    }

    private void launchInstaller(File apkFile, PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (!getContext().getPackageManager().canRequestPackageInstalls()) {
                        Intent permIntent = new Intent(
                            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + getContext().getPackageName())
                        );
                        permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(permIntent);
                        JSObject res = new JSObject();
                        res.put("status", "needs_permission");
                        call.resolve(res);
                        return;
                    }
                }

                Uri contentUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apkFile
                );
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);

                JSObject res = new JSObject();
                res.put("status", "installing");
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Gagal membuka installer Android: " + e.getMessage(), e);
            }
        });
    }
}
