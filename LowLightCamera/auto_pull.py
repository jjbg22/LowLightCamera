#!/usr/bin/env python3
# auto_pull.py

import subprocess
import time
import os
from pathlib import Path

# 패키지명을 실제 앱 패키지명으로 변경
PACKAGE_NAME = "com.lowlightcamera"  # 실제 패키지명으로 수정!
DEVICE_PATH = f"/sdcard/Android/data/{PACKAGE_NAME}/files/LowLightDebug"
LOCAL_PATH = "./debug_images"
PULLED_LIST_FILE = Path(LOCAL_PATH) / ".pulled_files.txt"

# 초기화
Path(LOCAL_PATH).mkdir(exist_ok=True)
PULLED_LIST_FILE.touch(exist_ok=True)

def run_adb(command):
    """ADB 명령 실행"""
    try:
        result = subprocess.run(
            f"adb shell \"{command}\"",
            shell=True,
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.stdout.strip().split('\n') if result.returncode == 0 else []
    except Exception as e:
        print(f"❌ ADB error: {e}")
        return []

def is_device_connected():
    """디바이스 연결 확인"""
    result = subprocess.run("adb devices", shell=True, capture_output=True, text=True)
    return "\tdevice" in result.stdout

def pull_file(remote_path, local_dir):
    """파일 pull"""
    try:
        result = subprocess.run(
            f"adb pull \"{remote_path}\" \"{local_dir}/\"",
            shell=True,
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Pull failed: {e}")
        return False

def get_pulled_timestamps():
    """이미 pull한 타임스탬프 목록"""
    if PULLED_LIST_FILE.exists():
        content = PULLED_LIST_FILE.read_text().strip()
        return set(content.split('\n')) if content else set()
    return set()

def mark_as_pulled(timestamp):
    """pull 완료 기록"""
    with open(PULLED_LIST_FILE, 'a') as f:
        f.write(f"{timestamp}\n")

print(f"🔍 Monitoring: {DEVICE_PATH}")
print(f"📁 Saving to: {LOCAL_PATH}")
print("=" * 50)

while True:
    try:
        if not is_device_connected():
            print("⚠️  No device connected, waiting...")
            time.sleep(3)
            continue
        
        # 마커 파일 검색
        marker_files = run_adb(f"ls {DEVICE_PATH}/*_ready.txt 2>/dev/null")
        pulled_timestamps = get_pulled_timestamps()
        
        for marker_file in marker_files:
            marker_file = marker_file.strip()
            if not marker_file or 'No such file' in marker_file:
                continue
            
            # 타임스탬프 추출
            filename = os.path.basename(marker_file)
            timestamp = filename.replace('_ready.txt', '')
            
            if timestamp in pulled_timestamps or not timestamp:
                continue
            
            print(f"\n📥 New batch detected: {timestamp}")
            
            # 해당 배치의 모든 이미지 pull
            image_files = run_adb(f"ls {DEVICE_PATH}/{timestamp}_*.jpg 2>/dev/null")
            
            success_count = 0
            for img_file in image_files:
                img_file = img_file.strip()
                if not img_file or 'No such file' in img_file:
                    continue
                
                img_name = os.path.basename(img_file)
                if pull_file(img_file, LOCAL_PATH):
                    print(f"  ✅ {img_name}")
                    success_count += 1
                else:
                    print(f"  ❌ Failed: {img_name}")
            
            if success_count > 0:
                # 마커 파일도 pull
                pull_file(marker_file, LOCAL_PATH)
                
                # 완료 표시
                mark_as_pulled(timestamp)
                print(f"✨ Batch complete: {timestamp} ({success_count} files)")
                print("-" * 50)
        
        time.sleep(1)
        
    except KeyboardInterrupt:
        print("\n\n👋 Stopped monitoring")
        break
    except Exception as e:
        print(f"❌ Error: {e}")
        time.sleep(2)