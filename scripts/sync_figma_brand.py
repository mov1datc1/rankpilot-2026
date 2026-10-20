#!/usr/bin/env python3
"""
Sync Figma Brandbook Assets for Rankings Decoded
Uses Figma REST API to download components and design tokens.
"""
import os
import sys
import json
import urllib.request
import urllib.error

# Read credentials strictly from environment or .env.local
TOKEN = os.environ.get("FIGMA_ACCESS_TOKEN", "")
FILE_KEY = os.environ.get("FIGMA_FILE_KEY", "XBEdRcU1REn2tRYFHN4JWI")

if not TOKEN:
    env_local_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    if os.path.exists(env_local_path):
        with open(env_local_path, "r") as f:
            for line in f:
                if line.startswith("FIGMA_ACCESS_TOKEN="):
                    TOKEN = line.split("=", 1)[1].strip().strip('"').strip("'")
                elif line.startswith("FIGMA_FILE_KEY="):
                    FILE_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")

def test_access():
    if not TOKEN:
        print("[ERROR] FIGMA_ACCESS_TOKEN not found in environment or .env.local")
        return None

    req = urllib.request.Request(
        f"https://api.figma.com/v1/files/{FILE_KEY}?depth=1",
        headers={"X-Figma-Token": TOKEN}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"[OK] Connected to Figma File: '{data.get('name')}'")
            return data
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"[HTTP {e.code}] Error accessing file: {body}")
        if "File not exportable" in body:
            print("[INFO] Waiting for owner approval of 'Can edit' permissions.")
        return None

if __name__ == "__main__":
    test_access()
