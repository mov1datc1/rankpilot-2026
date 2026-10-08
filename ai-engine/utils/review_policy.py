"""The HTTP boundary and editorial rules must advertise the same policy."""
import json
from pathlib import Path

REVIEW_POLICY_VERSION = json.loads(
    (Path(__file__).resolve().parents[1] / 'config' / 'editorial_rules.v1.json').read_text()
)['version']
