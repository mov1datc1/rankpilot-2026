import sys, os, json
sys.path.insert(0, os.path.abspath('ai-engine'))
from agents.nodes import extraction_node

state = {
    "doc_text": "Sample matter 1: advised on $50M acquisition.",
    "messages": [],
    "metadata": {},
    "matters": [],
    "analysis": {},
    "latex_code": "",
    "confidence_score": 0.0,
    "is_complete": False,
    "submission_context": {},
    "strategic_context": {}
}

try:
    print(extraction_node(state))
except Exception as e:
    import traceback
    traceback.print_exc()
