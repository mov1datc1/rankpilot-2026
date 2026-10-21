"""Offline counterexamples. No API calls; not a live-model error-rate benchmark."""
import json
from collections import Counter
from types import SimpleNamespace
from unittest.mock import patch
from agents.micro_optimizer import optimize_matter_micro
from core.review_graph import selection_gate, calibrate_verdict, BASE
from utils.rag_router import RAGRouter

source = 'The team represents Synthetic Client in a pending tax appeal. No decision has been issued.'
source_matter = {'id': 'm1', 'client': 'Synthetic Client', 'rawNotes': source,
                 'publish_status': 'publishable', 'confidentialityConfirmed': True}
unsupported = 'The team won USD 90 million and established a binding national precedent.'
with patch('agents.micro_optimizer.get_micro_model') as model:
    model.return_value.invoke.return_value = SimpleNamespace(content=unsupported, response_metadata={})
    micro = optimize_matter_micro(source_matter, practice_area='Tax')
strategy = {'matters': [{'matter_id': 'm1', 'disposition': 'core',
    'rationale': unsupported, 'source_quote': 'No decision has been issued.'}], 'hero_matter_id': 'm1'}
quote_gate = selection_gate({'package': {'matters': [source_matter]}, 'strategy': strategy})
misclassified = {'passed': False, 'defects': [{'severity': 'critical', 'scope': 'submission', 'matter_id': 'm1',
    'temporal_basis': 'missing_metadata', 'message': 'Source says closed in 2020; artifact invents completion in 2025.'}]}
rag = {}
for practice in ('Labour & Employment', 'Tax', 'Corporate / M&A', 'Unknown Practice'):
    chunks = RAGRouter().retrieve(practice, 'Chambers')
    rag[practice] = {'chunks': len(chunks), 'characters': sum(len(c.text) for c in chunks), 'sources': dict(Counter(c.source for c in chunks))}
result = {'method': 'Fault injection into real functions; all model responses mocked.',
    'unsupported_micro_text_accepted_as_draft': micro.get('success') and unsupported == micro.get('optimized_text'),
    'source_quote_gate_accepts_unsupported_rationale': quote_gate['selection_validated'],
    'misclassified_temporal_conflict_downgraded': calibrate_verdict(misclassified), 'rag_routing_sample': rag}
print(json.dumps(result, ensure_ascii=False, indent=2))
