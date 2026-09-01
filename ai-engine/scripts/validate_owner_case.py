#!/usr/bin/env python3
"""Offline acceptance runner for the two 31-08 owner cases."""

import argparse
import hashlib
import json
import sys
from pathlib import Path


AI_ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_ENGINE))

from utils.doc_parser import DocumentParser  # noqa: E402
from utils.ooxml_validation import validate_docx_ooxml  # noqa: E402


def validate(case: str, source: Path, optimized: Path, audit: Path) -> list[str]:
    fixture_path = AI_ENGINE / "tests" / "fixtures" / f"{case}_31_08.json"
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    errors: list[str] = []

    actual_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    if actual_hash != fixture["source_sha256"]:
        errors.append(
            f"source SHA-256 mismatch: expected {fixture['source_sha256']}, got {actual_hash}"
        )

    stats = DocumentParser.get_document_stats(str(source))["source_matters"]
    expected = fixture["expected_manifest"]
    for key in ("total", "publishable", "confidential"):
        if stats.get(key) != expected[key]:
            errors.append(
                f"source {key} mismatch: expected {expected[key]}, got {stats.get(key)}"
            )

    optimized_stats = DocumentParser.get_document_stats(str(optimized))["source_matters"]
    for key in ("total", "publishable", "confidential"):
        if optimized_stats.get(key) != expected[key]:
            errors.append(
                f"optimized {key} mismatch: expected {expected[key]}, got {optimized_stats.get(key)}"
            )

    for label, path in (("optimized", optimized), ("audit", audit)):
        package_errors = validate_docx_ooxml(path.read_bytes())
        errors.extend(f"{label} OOXML: {error}" for error in package_errors)

    optimized_text = DocumentParser.parse(str(optimized))
    audit_text = DocumentParser.parse(str(audit))
    combined = f"{optimized_text}\n{audit_text}"
    combined_lower = combined.casefold()

    hero = str(fixture.get("hero") or "")
    hero_tokens = [token.casefold() for token in hero.replace("/", " ").split() if len(token) > 3]
    if hero_tokens and not all(token in combined_lower for token in hero_tokens):
        errors.append(f"declared Hero is not traceable in outputs: {hero}")

    forbidden_groups = [
        fixture.get("forbidden_client_output", []),
        fixture.get("forbidden_balken_additions", []),
        fixture.get("forbidden_c2_additions", []),
        fixture.get("forbidden_positioning", []),
    ]
    for phrase in (item for group in forbidden_groups for item in group):
        if str(phrase).casefold() in combined_lower:
            errors.append(f"forbidden output phrase found: {phrase}")

    for lawyer in fixture.get("ranked_lawyers", []):
        if str(lawyer).casefold() not in audit_text.casefold():
            errors.append(f"ranked lawyer missing from Audit: {lawyer}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("case", choices=("araquereyna", "ramos_castillo"))
    parser.add_argument("source", type=Path)
    parser.add_argument("optimized", type=Path)
    parser.add_argument("audit", type=Path)
    args = parser.parse_args()

    errors = validate(args.case, args.source, args.optimized, args.audit)
    print(json.dumps({"case": args.case, "passed": not errors, "errors": errors}, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
