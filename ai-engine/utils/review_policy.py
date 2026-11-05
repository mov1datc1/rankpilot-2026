"""The HTTP boundary and editorial rules must advertise the same policy."""
import json
import re
from pathlib import Path

EDITORIAL_RULES = json.loads(
    (Path(__file__).resolve().parents[1] / 'config' / 'editorial_rules.v1.json').read_text()
)
REVIEW_POLICY_VERSION = EDITORIAL_RULES['version']
APPLICATION_RULES = EDITORIAL_RULES.get('application_rules', {})


def supports_editorial_directory(value):
    name=re.sub(r'[^a-z0-9]', '', str(value or '').casefold())
    return name in ('chambers','chamberspartners','chambersandpartners','legal500','thelegal500')


def restricted_delivery(matter, package):
    return (package.get('delivery_policy') == 'restricted-unconfirmed-v1'
            and matter.get('publication_route') == 'E'
            and matter.get('resolved_publication_status') in ('confidential', 'confirmation_required'))


def bind_application_rule(rule_id, quote, matter, package):
    """Application authority is never evidence of a client's legal facts."""
    rule = APPLICATION_RULES.get(rule_id)
    if (rule_id != 'restricted_confidential_delivery' or not rule
            or not restricted_delivery(matter, package)):
        return ''
    return rule if ' '.join(str(quote).split()) == ' '.join(rule.split()) else ''
