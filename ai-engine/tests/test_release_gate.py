import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


AI_ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_ENGINE))

from agents.constitutional_validator import (  # noqa: E402
    build_judge_retry_plan,
    run_layer1_checks,
    run_layer2_checks,
)
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

    def test_audit_and_b10_retry_does_not_request_matter_optimization(self):
        route, scopes, matter_ids = build_judge_retry_plan({
            "passed": False,
            "retryable": True,
            "checks": [
                {
                    "check_id": "b10_strategy",
                    "component": "b10_strategy",
                    "affected_matter_ids": [],
                    "passed": False,
                },
                {
                    "check_id": "strategic_audit",
                    "component": "strategic_audit",
                    "affected_matter_ids": [],
                    "passed": False,
                },
                {
                    "check_id": "matter_quality",
                    "component": "matter_quality",
                    "affected_matter_ids": [],
                    "passed": True,
                },
            ],
        })
        self.assertEqual("analysis", route)
        self.assertEqual(["audit", "b10"], scopes)
        self.assertEqual([], matter_ids)

    def test_matter_retry_targets_only_reported_matter_ids(self):
        route, scopes, matter_ids = build_judge_retry_plan({
            "passed": False,
            "retryable": True,
            "checks": [{
                "check_id": "matter_quality",
                "component": "matter_quality",
                "affected_matter_ids": ["matter-10", "matter-11"],
                "passed": False,
            }],
        })
        self.assertEqual("optimization", route)
        self.assertEqual(["matters"], scopes)
        self.assertEqual(["matter-10", "matter-11"], matter_ids)

    def test_matter_quality_without_ids_is_not_allowed_to_rerun_portfolio(self):
        route, scopes, matter_ids = build_judge_retry_plan({
            "passed": False,
            "retryable": True,
            "checks": [{
                "check_id": "matter_quality",
                "component": "matter_quality",
                "affected_matter_ids": [],
                "passed": False,
            }],
        })
        self.assertEqual(("none", [], []), (route, scopes, matter_ids))

    def test_field_provenance_failure_is_never_retried(self):
        route, scopes, matter_ids = build_judge_retry_plan({
            "passed": False,
            "retryable": True,
            "checks": [{
                "check_id": "field_provenance",
                "component": "field_provenance",
                "affected_matter_ids": ["matter-19"],
                "passed": False,
            }],
        })
        self.assertEqual(("none", [], []), (route, scopes, matter_ids))

    def test_judge_sol_evaluates_with_score_and_feedback_without_blocking_delivery(self):
        from agents.constitutional_validator import constitutional_validation_node

        mock_state = {
            "constitutional_retry_count": 0,
            "enhanced_b7": "Strong Chambers-focused narrative.",
            "matters": [{"summary": "Matter 1 description", "optimized_text": "Matter 1 optimized"}],
            "source_validation": {"passed": True},
            "evidence_reconciliation": {"passed": True},
            "artifact_validation": {"passed": True, "matter_rollbacks": []},
            "pipeline_manifest": {"extraction": {"match": True}},
        }

        with patch("utils.model_factory.create_chat_model", return_value=object()):
            with patch("agents.constitutional_validator.run_layer1_checks", return_value=(True, [])):
                with patch("agents.constitutional_validator.run_layer2_checks", return_value=(
                    False,
                    ["[MATTER-QUALITY] Matter 01 lacks competitive contrast"],
                    "none",
                    {
                        "score": 6,
                        "feedback": "Matter 01 needs clearer outcomes. Lawyer roles are somewhat generic.",
                        "passed": False,
                        "violations": ["[MATTER-QUALITY] Matter 01 lacks competitive contrast"],
                        "checks": [],
                    },
                )):
                    result = constitutional_validation_node(mock_state)

        # Must NOT be blocked: Layer 2 Judge SOL provides score and feedback, and delivery is approved!
        self.assertEqual("writing", result["constitutional_route"])
        self.assertTrue(result["release_verdict"]["passed"])
        self.assertEqual("RELEASE_APPROVED", result["release_verdict"]["code"])
        judge = result["release_verdict"]["judge"]
        self.assertEqual(6, judge["score"])
        self.assertIn("Matter 01 needs clearer outcomes", judge["feedback"])


if __name__ == "__main__":
    unittest.main()
