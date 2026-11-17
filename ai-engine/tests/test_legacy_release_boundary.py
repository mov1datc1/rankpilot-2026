"""The retired full-generation entry points answer 410 before any work runs."""
import asyncio
import json
import unittest
from types import SimpleNamespace

from main import service_boundary

RETIRED_PATHS = ('/process', '/process-async', '/download', '/generate-report', '/generate-docx')


class LegacyReleaseBoundaryTests(unittest.TestCase):
    def test_each_retired_path_is_gone_without_calling_the_app(self):
        called = []

        async def call_next(request):
            called.append(request.url.path)

        for path in RETIRED_PATHS:
            with self.subTest(path=path):
                request = SimpleNamespace(url=SimpleNamespace(path=path), headers={})
                response = asyncio.run(service_boundary(request, call_next))
                self.assertEqual(response.status_code, 410)
                self.assertEqual(json.loads(response.body)['code'], 'STUDIO_REQUIRED')
        self.assertEqual(called, [])

    def test_the_retired_graph_is_no_longer_loaded(self):
        import sys
        import main  # noqa: F401
        self.assertNotIn('core.graph', sys.modules)
        self.assertNotIn('agents.editorial_nodes', sys.modules)
