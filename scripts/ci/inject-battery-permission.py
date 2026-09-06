import re
import sys

manifest_path = "android/app/src/main/AndroidManifest.xml"

with open(manifest_path, "r") as f:
    manifest = f.read()

if "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" in manifest:
    print("battery optimization permission already injected")
    sys.exit(0)

permission = '    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />\n'

manifest, count = re.subn(
    r"(<application[^>]*>)",
    permission + r"\1",
    manifest,
    count=1,
)
if count == 0:
    print("Could not find '<application' tag in AndroidManifest.xml", file=sys.stderr)
    sys.exit(1)

with open(manifest_path, "w") as f:
    f.write(manifest)

print("battery optimization permission injected successfully")
