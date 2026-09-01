import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


AI_ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_ENGINE))

from agents.constitutional_validator import run_layer1_checks, run_layer2_checks  # noqa: E402
from utils.model_factory import get_model_profile, get_model_settings  # noqa: E402


class RaisingJudge:
    def with_structured_output(self, *args, **kwargs):
        raise RuntimeError("judge unavailable")


class ReleaseGateTests(unittest.TestCase):
    def test_judge_profile_uses_sol_and_xhigh_by_default(self):
        with patch.dict(os.environ, {}, clear=True):
            settings = get_model_settings("judge")
            profile = get_model_profile("judge")
        self.assertEqual("gpt-5.6-sol", settings["model"])
        self.assertEqual("xhigh", settings["reasoning_effort"])
        self.assertTrue(settings["use_responses_api"])
        self.assertEqual("responses", profile["api_mode"])

    def test_judge_exception_fails_closed(self):
        passed, violations, retry_target, verdict = run_layer2_checks(
            {"doc_text": "Source", "optimized_submission": {}, "strategic_audit": {}},
            RaisingJudge(),
        )
        self.assertFalse(passed)
        self.assertEqual("none", retry_target)
        self.assertFalse(verdict["passed"])
        self.assertTrue(any("JUDGE-ERROR" in item for item in violations))

    def test_artifact_rollback_fails_layer1(self):
        passed, violations = run_layer1_checks({
            "enhanced_b7": "A source-backed proposition.",
            "matters": [{"summary": "Source", "optimized_text": "Source"}],
            "source_validation": {"passed": True},
            "evidence_reconciliation": {"passed": True},
            "artifact_validation": {
                "passed": False,
                "errors": [],
                "matter_rollbacks": [{"matter_id": "matter-1"}],
            },
            "pipeline_manifest": {"extraction": {"match": True}},
        })
        self.assertFalse(passed)
        self.assertTrue(any("ARTIFACT-ROLLBACK" in item for item in violations))


if __name__ == "__main__":
    unittest.main()
