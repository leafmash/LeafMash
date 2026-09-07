import os
import shutil

source_path = "resources/android/raw/leafmash_message.ogg"
dest_dir = "android/app/src/main/res/raw"
dest_path = f"{dest_dir}/leafmash_message.ogg"

os.makedirs(dest_dir, exist_ok=True)
shutil.copyfile(source_path, dest_path)

print("notification sound injected successfully")
