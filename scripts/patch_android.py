import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRADLE_PATH = os.path.join(ROOT, "android", "app", "build.gradle")


def calc_version_code(ver: str) -> int:
    parts = [int(p) for p in re.findall(r"\d+", ver)[:3]]
    while len(parts) < 3:
        parts.append(0)
    return parts[0] * 10000 + parts[1] * 100 + parts[2]


def patch_build_gradle(version_name: str, version_code: int):
    with open(GRADLE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    content = re.sub(r"versionCode\s+\d+", f"versionCode {version_code}", content)
    content = re.sub(r'versionName\s+"[^"]*"', f'versionName "{version_name}"', content)

    with open(GRADLE_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Patched build.gradle: versionCode={version_code}, versionName={version_name}")


if __name__ == "__main__":
    ver = sys.argv[1] if len(sys.argv) > 1 else "1.3.3"
    code = int(sys.argv[2]) if len(sys.argv) > 2 else calc_version_code(ver)
    patch_build_gradle(ver, code)
