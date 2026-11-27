import os
import re
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NATIVE_DIR = os.path.join(ROOT, "native-android")
JAVA_DST = os.path.join(ROOT, "android", "app", "src", "main", "java", "com", "studypro", "notesync")
MANIFEST_PATH = os.path.join(ROOT, "android", "app", "src", "main", "AndroidManifest.xml")
FILE_PATHS_XML = os.path.join(ROOT, "android", "app", "src", "main", "res", "xml", "file_paths.xml")
GRADLE_PATH = os.path.join(ROOT, "android", "app", "build.gradle")

os.makedirs(JAVA_DST, exist_ok=True)
for fname in ("AppUpdaterPlugin.java", "MainActivity.java"):
    shutil.copyfile(os.path.join(NATIVE_DIR, fname), os.path.join(JAVA_DST, fname))
print("Copied Java plugin & MainActivity into", JAVA_DST)

# Ensure REQUEST_INSTALL_PACKAGES permission in AndroidManifest.xml
with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
    manifest = f.read()
perm = '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />'
if "REQUEST_INSTALL_PACKAGES" not in manifest:
    manifest = manifest.replace("</manifest>", f"    {perm}\n</manifest>")
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        f.write(manifest)
    print("Added REQUEST_INSTALL_PACKAGES to AndroidManifest.xml")

# Ensure <cache-path name="apk_updates" path="." /> in file_paths.xml
os.makedirs(os.path.dirname(FILE_PATHS_XML), exist_ok=True)
if os.path.exists(FILE_PATHS_XML):
    with open(FILE_PATHS_XML, "r", encoding="utf-8") as f:
        fp_xml = f.read()
else:
    fp_xml = '<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n</paths>\n'

if 'name="apk_updates"' not in fp_xml:
    fp_xml = fp_xml.replace("</paths>", '    <cache-path name="apk_updates" path="." />\n</paths>')
    with open(FILE_PATHS_XML, "w", encoding="utf-8") as f:
        f.write(fp_xml)
    print("Added cache-path to file_paths.xml")

# Patch versionCode and versionName in build.gradle
with open(GRADLE_PATH, "r", encoding="utf-8") as f:
    gradle = f.read()
run_num = os.environ.get("GITHUB_RUN_NUMBER", "1")
ver_name = os.environ.get("APP_VERSION", "1.3.0")
gradle = re.sub(r"versionCode\s+\d+", f"versionCode {run_num}", gradle)
gradle = re.sub(r'versionName\s+"[^"]+"', f'versionName "{ver_name}"', gradle)
with open(GRADLE_PATH, "w", encoding="utf-8") as f:
    f.write(gradle)
print(f"Patched build.gradle: versionCode={run_num}, versionName={ver_name}")
