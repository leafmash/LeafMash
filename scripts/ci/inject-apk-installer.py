import os
import re
import shutil
import sys

manifest_path = "android/app/src/main/AndroidManifest.xml"
xml_dest_dir = "android/app/src/main/res/xml"
xml_source = "resources/android/xml/file_paths.xml"

if not os.path.exists(manifest_path):
    print(f"Could not find {manifest_path}", file=sys.stderr)
    sys.exit(1)

os.makedirs(xml_dest_dir, exist_ok=True)
shutil.copyfile(xml_source, f"{xml_dest_dir}/file_paths.xml")

with open(manifest_path, "r") as f:
    manifest = f.read()

if "REQUEST_INSTALL_PACKAGES" not in manifest:
    permission = '    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n'
    manifest, count = re.subn(
        r"(<application[^>]*>)",
        permission + r"\1",
        manifest,
        count=1,
    )
    if count == 0:
        print("Could not find '<application' tag in AndroidManifest.xml", file=sys.stderr)
        sys.exit(1)

if "fileprovider" not in manifest:
    provider = (
        '        <provider\n'
        '            android:name="androidx.core.content.FileProvider"\n'
        '            android:authorities="${applicationId}.fileprovider"\n'
        '            android:exported="false"\n'
        '            android:grantUriPermissions="true">\n'
        '            <meta-data\n'
        '                android:name="android.support.FILE_PROVIDER_PATHS"\n'
        '                android:resource="@xml/file_paths" />\n'
        '        </provider>\n'
    )
    manifest = manifest.replace("</application>", provider + "    </application>", 1)

with open(manifest_path, "w") as f:
    f.write(manifest)

print("apk installer injected successfully")
