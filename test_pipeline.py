import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath('ai-engine'))
from core.graph import app

state = {
    "file_path": "",
    "raw_text": "Sample matter 1: advised on $50M acquisition.",
    "is_file": False,
    "submission_context": {
        "jurisdiction": "Mexico",
        "practice_area": "Corporate",
        "directory": "Chambers",
        "current_status": "Band 3"
    },
    "confidence_score": 0
}

async def run():
    try:
        config = {"configurable": {"thread_id": "123"}}
        result = await app.ainvoke(state, config=config)
        print("Success!")
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(run())
