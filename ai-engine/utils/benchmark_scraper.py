"""
Live Benchmark Scraper — v17.0
================================
Scrapes real-time ranking data from Chambers and Legal 500 public pages.
Used by context_engine_node to inject REAL benchmark data instead of 
letting the LLM invent firm names and band counts.

Architecture:
- ChambersScraper: Extracts Angular Transfer State JSON from SSR HTML
- Legal500Scraper: Parses Next.js SSR HTML DOM structure
- scrape_rankings(): Router that picks the right scraper + manages cache

Design principles:
- Graceful degradation: if scraping fails, return None (caller falls back to RAVL)
- Rate-limited: 2-5s delays, aggressive caching (30 days)
- No external dependencies beyond httpx (already in requirements.txt) + re/json
"""

import json
import os
import re
import time
import random
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple

try:
    import httpx
except ImportError:
    httpx = None
    print("[BENCHMARK SCRAPER] WARNING: httpx not available. Scraping disabled.")

from utils.benchmark_cache import (
    get_cached_benchmark,
    save_benchmark_cache,
    DEFAULT_TTL_DAYS
)


# ─────────────────────────────────────────────
# URL MAP LOADER
# ─────────────────────────────────────────────

_url_map_cache = None

def _load_url_map() -> dict:
    """Load and cache the benchmark URL map."""
    global _url_map_cache
    if _url_map_cache is not None:
        return _url_map_cache
    
    config_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "config", "benchmark_url_map.json"
    )
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            _url_map_cache = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"[BENCHMARK SCRAPER] Could not load URL map: {e}")
        _url_map_cache = {}
    return _url_map_cache


def _normalize_practice_area(practice_area: str) -> str:
    """Normalize practice area name using alias map."""
    url_map = _load_url_map()
    alias_map = url_map.get("alias_map", {})
    
    # Try exact match first
    if practice_area in alias_map:
        return alias_map[practice_area]
    
    # Try case-insensitive
    for alias, canonical in alias_map.items():
        if alias.lower() == practice_area.lower():
            return canonical
    
    return practice_area


def _get_url_config(directory: str, practice_area: str, jurisdiction: str) -> Optional[dict]:
    """Look up URL configuration for a (directory, practice, jurisdiction) combination."""
    url_map = _load_url_map()
    
    # Normalize
    dir_lower = directory.lower().strip()
    practice_normalized = _normalize_practice_area(practice_area)
    key = f"{practice_normalized}|{jurisdiction}"
    
    # Look up in the correct directory section
    dir_section = None
    if "chambers" in dir_lower:
        dir_section = url_map.get("chambers", {})
    elif "legal" in dir_lower or "500" in dir_lower:
        dir_section = url_map.get("legal500", {})
    
    if not dir_section:
        return None
    
    # Try exact key
    if key in dir_section:
        return dir_section[key]
    
    # Try case-insensitive
    for map_key, config in dir_section.items():
        if map_key.lower() == key.lower():
            return config
    
    return None


# ─────────────────────────────────────────────
# HTTP CLIENT
# ─────────────────────────────────────────────

_USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
]

def _fetch_html(url: str, params: str = "") -> Optional[str]:
    """Fetch HTML from URL with rate limiting and error handling."""
    if httpx is None:
        print("[BENCHMARK SCRAPER] httpx not available")
        return None
    
    full_url = f"{url}?{params}" if params else url
    
    # Random delay for rate limiting (2-5 seconds)
    delay = random.uniform(2.0, 5.0)
    print(f"[BENCHMARK SCRAPER] Fetching {full_url} (delay: {delay:.1f}s)")
    time.sleep(delay)
    
    headers = {
        "User-Agent": random.choice(_USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Connection": "keep-alive",
    }
    
    try:
        with httpx.Client(follow_redirects=True, timeout=30.0) as client:
            response = client.get(full_url, headers=headers)
            
            if response.status_code != 200:
                print(f"[BENCHMARK SCRAPER] HTTP {response.status_code} for {full_url}")
                return None
            
            html = response.text
            if len(html) < 1000:
                print(f"[BENCHMARK SCRAPER] Response too small ({len(html)} bytes) — likely blocked")
                return None
            
            print(f"[BENCHMARK SCRAPER] Fetched {len(html)} bytes from {full_url}")
            return html
            
    except Exception as e:
        print(f"[BENCHMARK SCRAPER] Fetch error: {e}")
        return None


# ─────────────────────────────────────────────
# CHAMBERS SCRAPER
# ─────────────────────────────────────────────

class ChambersScraper:
    """Extract ranking data from Chambers.com Angular Transfer State.
    
    Chambers uses Angular SSR with a <script type="application/json"> tag
    containing the full transfer state. Rankings data is stored across 
    multiple numeric keys:
    - Departments (firms) key: {description: "Departments", categories: [{organisations: [...]}]}
    - Lawyers key: [{description: "Lawyers", categories: [{individuals: [...]}]}]
    """
    
    @staticmethod
    def parse(html: str, practice_area: str, jurisdiction: str) -> Optional[Dict[str, Any]]:
        """Parse Chambers HTML and extract ranking data."""
        try:
            return ChambersScraper._extract_from_transfer_state(html, practice_area, jurisdiction)
        except Exception as e:
            print(f"[CHAMBERS SCRAPER] Parse error: {e}")
            return None
    
    @staticmethod
    def _extract_transfer_state(html: str) -> Optional[dict]:
        """Extract the Angular Transfer State JSON from HTML."""
        # Angular embeds transfer state in: <script type="application/json" id="...">...</script>
        pattern = r'<script[^>]*type="application/json"[^>]*>(.+?)</script>'
        matches = re.findall(pattern, html, re.DOTALL)
        
        if not matches:
            print("[CHAMBERS SCRAPER] No transfer state found in HTML")
            return None
        
        # The largest JSON block is typically the transfer state
        for match in matches:
            try:
                data = json.loads(match)
                if isinstance(data, dict) and len(data) > 3:
                    return data
            except json.JSONDecodeError:
                continue
        
        return None
    
    @staticmethod
    def _extract_from_transfer_state(html: str, practice_area: str, jurisdiction: str) -> Optional[Dict[str, Any]]:
        """Extract ranking data from Angular transfer state."""
        state = ChambersScraper._extract_transfer_state(html)
        if not state:
            return None
        
        result = {
            "source": "chambers",
            "practice_area": practice_area,
            "jurisdiction": jurisdiction,
            "guide": "",
            "structure": {
                "has_firm_bands": False,
                "has_individual_bands": False,
                "firm_bands": [],
                "individual_categories": [],
            },
            "firms": [],
            "individuals": [],
            "total_firms": 0,
            "total_individuals": 0,
            "editorial_summary": "",
        }
        
        # Extract subsection metadata (guide name, etc.)
        for key, val in state.items():
            if isinstance(val, dict) and "b" in val:
                body = val["b"]
                if isinstance(body, dict) and "subsection" in body:
                    sub = body["subsection"]
                    if isinstance(sub, dict):
                        result["guide"] = sub.get("publicationTypeDescription", "")
                        break
        
        # Find all keys that contain ranking data (Band/categories/individuals/organisations)
        departments_data = None
        lawyers_data = None
        
        for key, val in state.items():
            if not isinstance(val, dict) or "b" not in val:
                continue
            
            body = val["b"]
            body_str = json.dumps(body, ensure_ascii=False)[:10000]  # Quick scan
            
            # Check for Departments (firms)
            if isinstance(body, dict) and body.get("description") == "Departments":
                departments_data = body
                continue
            
            # Check for Lawyers (individuals) — can be in a list or dict
            if isinstance(body, list):
                for section in body:
                    if isinstance(section, dict):
                        if section.get("description") == "Departments" and not departments_data:
                            departments_data = section
                        elif section.get("description") == "Lawyers" and not lawyers_data:
                            lawyers_data = section
            elif isinstance(body, dict) and body.get("description") == "Lawyers":
                lawyers_data = body
        
        # Process Departments (firms)
        if departments_data:
            categories = departments_data.get("categories", [])
            result["structure"]["has_firm_bands"] = len(categories) > 0
            
            for cat in categories:
                band_name = cat.get("description", "")
                result["structure"]["firm_bands"].append(band_name)
                
                for org in cat.get("organisations", []):
                    firm = {
                        "name": org.get("organisationName", org.get("displayName", "")),
                        "band": band_name,
                        "rank_type": cat.get("rankType", ""),
                    }
                    result["firms"].append(firm)
        
        # Process Lawyers (individuals)
        if lawyers_data:
            categories = lawyers_data.get("categories", [])
            result["structure"]["has_individual_bands"] = len(categories) > 0
            
            for cat in categories:
                cat_name = cat.get("description", "")
                result["structure"]["individual_categories"].append(cat_name)
                
                for ind in cat.get("individuals", []):
                    individual = {
                        "name": ind.get("displayName", ""),
                        "firm": ind.get("organisationName", ""),
                        "band": cat_name,
                        "rank_type": cat.get("rankType", ""),
                        "years_ranked": ind.get("rankedYearsCount", 0),
                    }
                    result["individuals"].append(individual)
        
        result["total_firms"] = len(result["firms"])
        result["total_individuals"] = len(result["individuals"])
        
        # Extract editorial content if available
        for key, val in state.items():
            if isinstance(val, dict) and "b" in val:
                body = val["b"]
                if isinstance(body, list):
                    for item in body:
                        if isinstance(item, dict) and "contentIntro" in item:
                            result["editorial_summary"] = item.get("contentIntro", "")[:500]
                            break
        
        if result["total_firms"] == 0 and result["total_individuals"] == 0:
            print("[CHAMBERS SCRAPER] No ranking data found in transfer state")
            return None
        
        print(f"[CHAMBERS SCRAPER] Extracted: {result['total_firms']} firms, "
              f"{result['total_individuals']} individuals, "
              f"firm_bands={result['structure']['firm_bands']}, "
              f"individual_cats={result['structure']['individual_categories']}")
        
        return result


# ─────────────────────────────────────────────
# LEGAL 500 SCRAPER
# ─────────────────────────────────────────────

class Legal500Scraper:
    """Extract ranking data from Legal500.com Next.js SSR HTML.
    
    Legal 500 uses Next.js with SSR. The HTML contains:
    - <ul data-testid="ranking-group"> blocks for each tier
    - <h3 class="sr-only">Tier X</h3> inside each group
    - <li data-testid="ranking-table-row"> for each firm
    - <h4> tags with firm names (bold = ranked, normal = watch list)
    - Tier badge numbers in <span> circles
    """
    
    @staticmethod
    def parse(html: str, practice_area: str, jurisdiction: str) -> Optional[Dict[str, Any]]:
        """Parse Legal 500 HTML and extract ranking data."""
        try:
            return Legal500Scraper._extract_from_html(html, practice_area, jurisdiction)
        except Exception as e:
            print(f"[LEGAL500 SCRAPER] Parse error: {e}")
            return None
    
    @staticmethod
    def _extract_from_html(html: str, practice_area: str, jurisdiction: str) -> Optional[Dict[str, Any]]:
        """Extract ranking data from Legal 500 SSR HTML structure."""
        result = {
            "source": "legal500",
            "practice_area": practice_area,
            "jurisdiction": jurisdiction,
            "guide": "",
            "structure": {
                "has_firm_bands": False,
                "has_individual_bands": False,
                "firm_bands": [],
                "individual_categories": [],
            },
            "firms": [],
            "individuals": [],
            "total_firms": 0,
            "total_individuals": 0,
            "editorial_summary": "",
        }
        
        # ── Extract tier headers ──
        # Pattern: <h3 class="sr-only">Tier X</h3>
        tier_headers = re.findall(r'<h3\s+class="sr-only">([^<]+)</h3>', html)
        
        if not tier_headers:
            print("[LEGAL500 SCRAPER] No tier headers found")
            return None
        
        # ── Extract ranking groups with their firms ──
        # Split HTML by ranking-group boundaries
        # Each group starts with data-testid="ranking-group" and contains a tier header + firm rows
        group_pattern = r'data-testid="ranking-group">(.*?)(?=data-testid="ranking-group"|$)'
        groups = re.findall(group_pattern, html, re.DOTALL)
        
        if not groups:
            # Fallback: use the tier headers to segment the content
            # Find positions of each tier header to segment firms
            groups = Legal500Scraper._segment_by_tiers(html, tier_headers)
        
        for group_html in groups:
            # Get tier name from sr-only h3
            tier_match = re.search(r'<h3\s+class="sr-only">([^<]+)</h3>', group_html)
            if not tier_match:
                continue
            
            tier_name = tier_match.group(1).strip()
            
            # Map "Tier 0" to "Firms to Watch"
            display_tier = "Firms to Watch" if tier_name == "Tier 0" else tier_name
            
            result["structure"]["firm_bands"].append(display_tier)
            
            # Extract firm names from h4 tags
            # Bold firms (ranked): typography-interface-l-bold
            # Non-bold firms (firms to watch in lower tiers): typography-interface-l
            firm_names_bold = re.findall(
                r'typography-interface-l-bold">\s*([^<]+?)\s*</h4>', 
                group_html
            )
            firm_names_normal = re.findall(
                r'typography-interface-l">\s*([^<]+?)\s*</h4>', 
                group_html
            )
            
            all_firms = firm_names_bold + firm_names_normal
            
            for name in all_firms:
                # Filter out navigation items
                name = name.strip()
                if name in ("Comparative Guides", "Events", "Legal 500 TV", 
                           "Rankings", "Firms & Lawyers", "In-House", 
                           "Knowledge Centre", ""):
                    continue
                
                # Decode HTML entities
                name = name.replace("&amp;", "&").replace("&#x27;", "'").replace("&quot;", '"')
                
                result["firms"].append({
                    "name": name,
                    "band": display_tier,
                })
        
        result["structure"]["has_firm_bands"] = len(result["structure"]["firm_bands"]) > 0
        result["total_firms"] = len(result["firms"])
        
        # ── Check for lawyer tab URL ──
        # Legal 500 has separate /lawyers page
        lawyer_url_match = re.search(r'href="([^"]*?/lawyers)"', html)
        if lawyer_url_match:
            result["_lawyers_url"] = lawyer_url_match.group(1)
        
        if result["total_firms"] == 0:
            print("[LEGAL500 SCRAPER] No firms found")
            return None
        
        print(f"[LEGAL500 SCRAPER] Extracted: {result['total_firms']} firms, "
              f"tiers={result['structure']['firm_bands']}")
        
        return result
    
    @staticmethod
    def _segment_by_tiers(html: str, tier_headers: list) -> list:
        """Segment HTML into groups based on tier header positions."""
        segments = []
        for i, tier in enumerate(tier_headers):
            pattern = re.escape(f'<h3 class="sr-only">{tier}</h3>')
            match = re.search(pattern, html)
            if match:
                start = match.start()
                if i + 1 < len(tier_headers):
                    next_pattern = re.escape(f'<h3 class="sr-only">{tier_headers[i+1]}</h3>')
                    next_match = re.search(next_pattern, html[start + 1:])
                    if next_match:
                        end = start + 1 + next_match.start()
                    else:
                        end = len(html)
                else:
                    end = len(html)
                segments.append(html[start:end])
        return segments


# ─────────────────────────────────────────────
# MAIN ROUTER
# ─────────────────────────────────────────────

def scrape_rankings(directory: str, practice_area: str, jurisdiction: str,
                    force_refresh: bool = False,
                    ttl_days: int = DEFAULT_TTL_DAYS) -> Optional[Dict[str, Any]]:
    """Main entry point: scrape or retrieve cached benchmark data.
    
    Workflow:
    1. Check cache — if valid, return cached data
    2. Look up URL from benchmark_url_map.json
    3. Fetch HTML
    4. Parse with appropriate scraper
    5. Save to cache
    6. Return structured benchmark data
    
    Args:
        directory: "Chambers" or "Legal 500"
        practice_area: e.g. "Banking & Finance"
        jurisdiction: e.g. "Mexico"
        force_refresh: Skip cache and re-scrape
        ttl_days: Cache TTL in days (default 30)
    
    Returns:
        Dict with benchmark data, or None if scraping fails.
    """
    # 0. Normalize practice area via alias map (before cache key generation)
    practice_area = _normalize_practice_area(practice_area)
    
    # 1. Check cache
    if not force_refresh:
        cached = get_cached_benchmark(directory, practice_area, jurisdiction, ttl_days)
        if cached:
            return cached
    
    # 2. Look up URL
    url_config = _get_url_config(directory, practice_area, jurisdiction)
    if not url_config:
        print(f"[BENCHMARK SCRAPER] No URL mapped for {directory}/{practice_area}/{jurisdiction}")
        return None
    
    url = url_config.get("url", "")
    params = url_config.get("params", "")
    
    if not url:
        print(f"[BENCHMARK SCRAPER] Empty URL for {directory}/{practice_area}/{jurisdiction}")
        return None
    
    # 3. Fetch HTML
    html = _fetch_html(url, params)
    if not html:
        return None
    
    # 4. Parse with appropriate scraper
    dir_lower = directory.lower().strip()
    result = None
    
    if "chambers" in dir_lower:
        result = ChambersScraper.parse(html, practice_area, jurisdiction)
        if result:
            result["guide"] = url_config.get("guide", "")
    elif "legal" in dir_lower or "500" in dir_lower:
        result = Legal500Scraper.parse(html, practice_area, jurisdiction)
    else:
        print(f"[BENCHMARK SCRAPER] Unknown directory: {directory}")
        return None
    
    if not result:
        return None
    
    # 5. Save to cache
    save_benchmark_cache(directory, practice_area, jurisdiction, result)
    
    return result


def get_benchmark_summary(benchmark_data: Dict[str, Any]) -> str:
    """Generate a human-readable summary of benchmark data for prompt injection.
    
    This is what gets injected into the LLM strategic context.
    """
    if not benchmark_data:
        return ""
    
    source = benchmark_data.get("source", "unknown")
    practice = benchmark_data.get("practice_area", "")
    jurisdiction = benchmark_data.get("jurisdiction", "")
    scraped_at = benchmark_data.get("scraped_at", "unknown date")
    
    lines = [
        f"LIVE BENCHMARK DATA (verified from {source.upper()} on {scraped_at}):",
        f"Practice: {practice} | Jurisdiction: {jurisdiction}",
    ]
    
    structure = benchmark_data.get("structure", {})
    
    # Firm bands
    if structure.get("has_firm_bands"):
        firm_bands = structure.get("firm_bands", [])
        total_firms = benchmark_data.get("total_firms", 0)
        lines.append(f"- Firm ranking: YES — {total_firms} ranked firms across {len(firm_bands)} bands/tiers")
        lines.append(f"- Firm bands available: {', '.join(firm_bands)}")
        
        # List top firms per band (first 3)
        firms = benchmark_data.get("firms", [])
        bands_shown = set()
        for firm in firms:
            band = firm.get("band", "")
            if band not in bands_shown:
                band_firms = [f["name"] for f in firms if f.get("band") == band]
                if len(band_firms) > 3:
                    firms_str = ", ".join(band_firms[:3]) + f" (+{len(band_firms)-3} more)"
                else:
                    firms_str = ", ".join(band_firms)
                lines.append(f"  • {band}: {firms_str}")
                bands_shown.add(band)
    else:
        lines.append("- Firm ranking: NO — this practice does NOT rank firms/departments")
    
    # Individual categories
    if structure.get("has_individual_bands"):
        ind_cats = structure.get("individual_categories", [])
        total_ind = benchmark_data.get("total_individuals", 0)
        lines.append(f"- Individual ranking: YES — {total_ind} ranked lawyers across {len(ind_cats)} categories")
        lines.append(f"- Individual categories: {', '.join(ind_cats)}")
        
        # Show top individuals per category (first 2)
        individuals = benchmark_data.get("individuals", [])
        cats_shown = set()
        for ind in individuals:
            cat = ind.get("band", "")
            if cat not in cats_shown:
                cat_inds = [f"{i['name']} ({i['firm']})" for i in individuals if i.get("band") == cat]
                if len(cat_inds) > 2:
                    inds_str = ", ".join(cat_inds[:2]) + f" (+{len(cat_inds)-2} more)"
                else:
                    inds_str = ", ".join(cat_inds)
                lines.append(f"  • {cat}: {inds_str}")
                cats_shown.add(cat)
    
    # Editorial
    editorial = benchmark_data.get("editorial_summary", "")
    if editorial:
        lines.append(f"- Editorial context: \"{editorial[:200]}...\"" if len(editorial) > 200 else f"- Editorial context: \"{editorial}\"")
    
    return "\n".join(lines)
