# Python runtime compatibility v1.0.25

A fresh production test stopped before the selection model call because the review module imported Python 3.11 StrEnum while the engine image uses Python 3.10. Health had reported online because that module was loaded only when a review request arrived. This was an application import failure, not a client connection failure or a finding in source evidence.

Use a string Enum with explicit literal string conversion to preserve schema choices and both Python and JSON model serialization on Python 3.10. Load the editorial graph during application startup so an import failure prevents healthy startup. Align the existing CI suite with the production Python version.

Local validation: 499 Python tests pass, including Python-mode proof serialization and field/source checks. The Python 3.10 CI result and the new fixed-version production acceptance are recorded separately after execution. No judge, privacy, approval, budget or retry gates are relaxed. The interrupted test remains in history and cannot count as autonomous acceptance.
