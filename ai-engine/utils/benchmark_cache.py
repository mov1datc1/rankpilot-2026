"""
Benchmark Cache Manager — v17.0
================================
Manages local JSON cache for scraped benchmark data.
Cache files live in config/benchmark_cache/ with TTL validation.

Design principles:
- Cache key = sanitized "{directory}_{practice}_{jurisdiction}" 
- TTL default = 30 days (rankings update every few months)
- Graceful: missing/corrupt cache → returns None (caller falls back)
"""

import json
import os
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any


# Base path for cache files
CACHE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "config", "benchmark_cache"
)

DEFAULT_TTL_DAYS = 30


def _sanitize_key(directory: str, practice_area: str, jurisdiction: str) -> str:
    """Convert (directory, practice, jurisdiction) into a safe filename key.
    
    Example: ("chambers", "Banking & Finance", "Mexico") → "chambers_banking_finance_mexico"
    """
    raw = f"{directory}_{practice_area}_{jurisdiction}"
    # Lowercase, replace non-alphanumeric with underscore, collapse multiples
    sanitized = re.sub(r'[^a-z0-9]+', '_', raw.lower()).strip('_')
    return sanitized


def _ensure_cache_dir():
    """Create cache directory if it doesn't exist."""
    os.makedirs(CACHE_DIR, exist_ok=True)


def get_cached_benchmark(directory: str, practice_area: str, 
                          jurisdiction: str, ttl_days: int = DEFAULT_TTL_DAYS) -> Optional[Dict[str, Any]]:
    """Retrieve cached benchmark data if it exists and is within TTL.
    
    Returns:
        dict with benchmark data if cache hit and valid, None otherwise.
    """
    key = _sanitize_key(directory, practice_area, jurisdiction)
    cache_path = os.path.join(CACHE_DIR, f"{key}.json")
    
    if not os.path.exists(cache_path):
        print(f"[BENCHMARK CACHE] MISS — no cache file for {key}")
        return None
    
    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            cached = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"[BENCHMARK CACHE] ERROR — corrupt cache file {key}: {e}")
        return None
    
    # Validate TTL
    scraped_at = cached.get("scraped_at", "")
    if not scraped_at:
        print(f"[BENCHMARK CACHE] MISS — no timestamp in cache {key}")
        return None
    
    try:
        scraped_dt = datetime.fromisoformat(scraped_at.replace("Z", "+00:00"))
        # Compare in naive UTC
        scraped_naive = scraped_dt.replace(tzinfo=None)
        now_naive = datetime.utcnow()
        age = now_naive - scraped_naive
        
        if age > timedelta(days=ttl_days):
            print(f"[BENCHMARK CACHE] EXPIRED — {key} is {age.days} days old (TTL={ttl_days})")
            return None
        
        print(f"[BENCHMARK CACHE] HIT — {key} is {age.days} days old (TTL={ttl_days})")
        return cached
        
    except (ValueError, TypeError) as e:
        print(f"[BENCHMARK CACHE] ERROR — invalid timestamp in {key}: {e}")
        return None


def save_benchmark_cache(directory: str, practice_area: str, 
                          jurisdiction: str, data: Dict[str, Any]) -> bool:
    """Save benchmark data to cache with current timestamp.
    
    Returns:
        True if saved successfully, False otherwise.
    """
    _ensure_cache_dir()
    
    key = _sanitize_key(directory, practice_area, jurisdiction)
    cache_path = os.path.join(CACHE_DIR, f"{key}.json")
    
    # Inject timestamps
    now = datetime.utcnow()
    data["scraped_at"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    data["cache_valid_until"] = (now + timedelta(days=DEFAULT_TTL_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    data["cache_key"] = key
    
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"[BENCHMARK CACHE] SAVED — {key} ({len(json.dumps(data))} bytes)")
        return True
    except IOError as e:
        print(f"[BENCHMARK CACHE] ERROR — failed to save {key}: {e}")
        return False


def is_cache_valid(directory: str, practice_area: str, 
                    jurisdiction: str, ttl_days: int = DEFAULT_TTL_DAYS) -> bool:
    """Quick check if valid cache exists without loading full data."""
    return get_cached_benchmark(directory, practice_area, jurisdiction, ttl_days) is not None


def invalidate_cache(directory: str, practice_area: str, jurisdiction: str) -> bool:
    """Force-expire a cache entry by deleting the file.
    
    Returns:
        True if file was deleted, False if it didn't exist.
    """
    key = _sanitize_key(directory, practice_area, jurisdiction)
    cache_path = os.path.join(CACHE_DIR, f"{key}.json")
    
    if os.path.exists(cache_path):
        os.remove(cache_path)
        print(f"[BENCHMARK CACHE] INVALIDATED — {key}")
        return True
    return False


def list_cached_benchmarks() -> list:
    """List all cached benchmarks with their age."""
    if not os.path.exists(CACHE_DIR):
        return []
    
    results = []
    now = datetime.utcnow()
    
    for filename in os.listdir(CACHE_DIR):
        if not filename.endswith(".json"):
            continue
        
        filepath = os.path.join(CACHE_DIR, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            scraped_at = data.get("scraped_at", "unknown")
            age_days = "?"
            if scraped_at != "unknown":
                try:
                    scraped_dt = datetime.fromisoformat(scraped_at.replace("Z", "+00:00")).replace(tzinfo=None)
                    age_days = (now - scraped_dt).days
                except ValueError:
                    pass
            
            results.append({
                "key": filename.replace(".json", ""),
                "source": data.get("source", "unknown"),
                "practice_area": data.get("practice_area", ""),
                "jurisdiction": data.get("jurisdiction", ""),
                "scraped_at": scraped_at,
                "age_days": age_days,
                "total_firms": data.get("total_firms", 0),
                "total_individuals": data.get("total_individuals", 0),
            })
        except (json.JSONDecodeError, IOError):
            results.append({"key": filename, "error": "corrupt"})
    
    return results
