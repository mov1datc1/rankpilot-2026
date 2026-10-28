import sys, os, json
sys.path.insert(0, os.path.abspath('ai-engine'))
from core.graph import app as graph_app
from langchain_core.messages import HumanMessage

initial_state = {
    "file_path": "",
    "doc_text": "Sample practice area description with $50M deals and disputes.",
    "messages": [HumanMessage(content="Please process this document.")],
    "metadata": {},
    "matters": [],
    "analysis": {},
    "latex_code": "",
    "confidence_score": 0.0,
    "is_complete": False,
    "submission_context": {
        "directory": "Chambers",
        "jurisdiction": "Mexico",
        "practice_area": "Banking & Finance",
        "current_status": "Unranked"
    },
    "strategic_context": {}
}

config = {"configurable": {"thread_id": "test_123"}}

try:
    result = graph_app.invoke(initial_state, config)
    print("SUCCESS!")
except Exception as e:
    import traceback
    traceback.print_exc()
