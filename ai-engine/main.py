import os
import re
import uuid
import json
import asyncio
import traceback
import base64
import time
from datetime import datetime, timezone
import httpx
from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from core.graph import app as graph_app 
from langchain_core.messages import HumanMessage
from agents.nodes import writer_node
from utils.docx_generator import generate_docx_report
from utils.language_guard import filter_pipeline_output
from utils.ooxml_validation import validate_docx_ooxml
from utils.model_response import coerce_message_text
from core.docx_cloner import clone_and_replace_from_state
from utils.editorial_memory import (
    load_memory, save_memory, extract_lessons_from_result, format_memory_for_prompt
)


def sanitize_unicode(text: str) -> str:
    """Remove or replace problematic Unicode escape sequences and control characters."""
    if not isinstance(text, str):
        return str(text) if text is not None else ""
    # Remove null bytes
    text = text.replace('\x00', '')
    # Remove other control characters (except newline, tab, carriage return)
    text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    # Fix invalid Unicode escape sequences like \uD800-\uDFFF (surrogates)
    text = text.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
    return text


def safe_json_dumps(obj) -> str:
    """JSON serialize with Unicode safety."""
    try:
        return json.dumps(obj, indent=2, default=str, ensure_ascii=False)
    except (TypeError, ValueError):
        return json.dumps(obj, indent=2, default=str, ensure_ascii=True)


class PipelineReleaseError(RuntimeError):
    def __init__(self, code: str, message: str, details=None):
        super().__init__(message)
        self.code = code
        self.details = details or []


def _assert_release_approved(result: dict) -> None:
    """Log audit status; never block user delivery on quality review checks."""

    checks = {
        "source_validation": result.get("source_validation", {}),
        "evidence_reconciliation": result.get("evidence_reconciliation", {}),
        "artifact_validation": result.get("artifact_validation", {}),
        "constitutional_validation": result.get("constitutional_validation", {}),
        "release_verdict": result.get("release_verdict", {}),
    }
    failed = [name for name, check in checks.items() if check.get("passed") is not True]
    rollbacks = checks["artifact_validation"].get("matter_rollbacks") or []
    if rollbacks:
        failed.append("artifact_validation.matter_rollbacks")
    if failed:
        print(f"[RELEASE AUDIT] ⚠️ Audit checks flagged: {failed}. Delivering results to user and preserving logs for Admin.")

# 1. Instancia de la API para comunicación con el Backend
api = FastAPI(title="RankPilot AI Core", version="26.26")

# CORS Configuration
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@api.get("/")
def read_root():
    return {
        "status": "online",
        "service": "RankPilot Core Engine",
        "version": "26.26",
        "environment": "Ubuntu/Docker"
    }

@api.get("/health")
async def health_check():
    """
    Verifica que el servidor FastAPI está corriendo correctamente.
    """
    return {
        "status": "online",
        "message": "RankPilot Core is online",
        "version": "26.26",
        "environment": "Ubuntu/Docker"
    }

def run_rankpilot(user_input: str, thread_id: str, is_file: bool = False):
    """
    Orquestador del Grafo. Procesa la entrada y devuelve el estado final.
    """
    config = {"configurable": {"thread_id": thread_id}}
    
    if is_file:
        initial_state = {"file_path": user_input, "messages": []}
        output = graph_app.invoke(initial_state, config)
        _assert_release_approved(output)
    else:
        output = graph_app.invoke(
            {"messages": [HumanMessage(content=user_input)]}, 
            config
        )
    
    if output.get("is_complete"):
        raw_path = output.get("pdf_url")
        if raw_path and os.path.exists(raw_path):
            output["pdf_url"] = os.path.abspath(raw_path)
            
    return output

@api.post("/process")
async def process_document(request: Request):
    """
    Endpoint principal para procesar documentos de submissions y pasarlos por el pipeline completo.
    Ahora recibe un 'context' obligatorio con: directory, jurisdiction, practice_area, current_status.
    """
    try:
        data = await request.json()
    except Exception as e:
        return JSONResponse(status_code=400, content={
            "error": "Invalid JSON in request body",
            "error_code": "INVALID_REQUEST",
            "details": str(e)
        })

    user_input = data.get("user_input")
    thread_id = data.get("thread_id")
    is_file = data.get("is_file", False)
    context = data.get("context", {})

    if not user_input or not thread_id:
        return JSONResponse(status_code=400, content={
            "error": "Missing user_input or thread_id",
            "error_code": "MISSING_PARAMS"
        })

    config = {"configurable": {"thread_id": thread_id}}

    # Sanitize user input text to prevent Unicode issues downstream
    sanitized_input = sanitize_unicode(user_input) if not is_file else user_input

    initial_state = {
        "file_path": user_input if is_file else "",
        "doc_text": sanitized_input if not is_file else "",
        "messages": [HumanMessage(content="Please process this submission document.")],
        "metadata": {},
        "matters": [],
        "analysis": {},
        "latex_code": "",
        "confidence_score": 0.0,
        "is_complete": False,
        "pdf_url": "",
        "submission_context": context,
        "strategic_context": {},
        # Editorial Reasoning Engine — initial empty state
        "comprehension": {},
        "competitive_identity": {},
        "hypotheses": [],
        "refutation_results": {},
        "comparative_analysis": {},
        "editorial_confidence": {},
        "narrative_architecture": {},
        "submission_blueprint": {},
        "evidence_map": {},
        "reasoning_trace": [],
        "editorial_memory": "",
        "current_step": "ingestion",
        "pipeline_manifest": {},
        "source_validation": {},
        "release_verdict": {},
        "canonical_submission": {},
        "strategic_objective": {},
        "evidence_ledger": {},
        "gaps": [],
        "interrogation_questions": [],
        "evidence_reconciliation": {},
        "requires_user_input": False,
        "optimized_submission": {},
        "strategic_audit": {},
        "artifact_validation": {},
        "matter_evidence_gaps": {},
        "original_b10": "",
        "original_c2": "",
        "enhanced_b7": "",
    }

    # v7.0: Load editorial memory for this practice area + jurisdiction
    editorial_memory_context = ""
    try:
        practice_area = context.get("practice_area", "")
        jurisdiction = context.get("jurisdiction", "")
        if practice_area and jurisdiction:
            memory_bank = load_memory(practice_area, jurisdiction)
            editorial_memory_context = format_memory_for_prompt(memory_bank)
            if editorial_memory_context:
                initial_state["editorial_memory"] = editorial_memory_context
                print(f"[EDITORIAL MEMORY] Loaded {memory_bank.total_submissions_processed} past submissions for {practice_area}/{jurisdiction}")
    except Exception as e:
        print(f"[EDITORIAL MEMORY] Warning: Could not load memory: {e}")
    
    try:
        result = graph_app.invoke(initial_state, config)
        _assert_release_approved(result)
    except Exception as e:
        error_msg = traceback.format_exc()
        print(f"[PIPELINE ERROR] LangGraph execution failed for thread {thread_id}:")
        print(error_msg)
        return JSONResponse(status_code=500, content={
            "error": "The AI engine encountered an error while processing your document. Please try again or contact support.",
            "error_code": "PIPELINE_EXECUTION_ERROR",
            "details": str(e),
            "thread_id": thread_id
        })
    
    # Safely extract the last message text
    try:
        messages = result.get("messages", [])
        response_text = "No response generated."
        if messages:
            last_msg = messages[-1]
            if hasattr(last_msg, "content"):
                response_text = sanitize_unicode(coerce_message_text(last_msg.content))
            elif isinstance(last_msg, tuple) and len(last_msg) > 1:
                response_text = sanitize_unicode(str(last_msg[1]))
            else:
                response_text = sanitize_unicode(str(last_msg))
    except Exception as e:
        print(f"[RESPONSE PARSE ERROR] Failed to extract messages: {e}")
        response_text = "Processing completed but response extraction failed."
    
    # Build response with safe serialization
    try:
        response_data = {
            "status": "completed" if result.get("is_complete") else "interrogating",
            "thread_id": thread_id,
            "data": {
                "pdf_url": result.get("pdf_url"),
                "is_complete": result.get("is_complete", False),
                "response": response_text,
                "metadata": result.get("metadata", {}),
                "matters": result.get("matters", []),
                "analysis": result.get("analysis", {}),
                "strategic_context": result.get("strategic_context", {}),
                # Editorial Reasoning Engine outputs
                "comprehension": result.get("comprehension", {}),
                "competitive_identity": result.get("competitive_identity", {}),
                "hypotheses": result.get("hypotheses", []),
                "refutation_results": result.get("refutation_results", {}),
                "comparative_analysis": result.get("comparative_analysis", {}),
                "editorial_confidence": result.get("editorial_confidence", {}),
                "narrative_architecture": result.get("narrative_architecture", {}),
                "submission_blueprint": result.get("submission_blueprint", {}),
                "reasoning_trace": result.get("reasoning_trace", []),
                "pipeline_manifest": result.get("pipeline_manifest", {}),
                "enhanced_b7": result.get("enhanced_b7", ""),
                "enhanced_c2": result.get("enhanced_c2", ""),
                "canonical_submission": result.get("canonical_submission", {}),
                "strategic_objective": result.get("strategic_objective", {}),
                "gaps": result.get("gaps", []),
                "interrogation_questions": result.get("interrogation_questions", []),
                "optimized_submission": result.get("optimized_submission", {}),
                "strategic_audit": result.get("strategic_audit", {}),
                "artifact_validation": result.get("artifact_validation", {}),
                "matter_evidence_gaps": result.get("matter_evidence_gaps", {}),
                "evidence_reconciliation": result.get("evidence_reconciliation", {}),
                "source_validation": result.get("source_validation", {}),
                "constitutional_validation": result.get("constitutional_validation", {}),
                "release_verdict": result.get("release_verdict", {}),
            }
        }

        # v7.0: Apply epistemic language guard to ALL AI output
        response_data["data"] = filter_pipeline_output(response_data["data"])

        # v7.0: Save editorial memory (lessons learned from this submission)
        try:
            practice_area = context.get("practice_area", "")
            jurisdiction = context.get("jurisdiction", "")
            if practice_area and jurisdiction:
                lessons = extract_lessons_from_result(response_data["data"], practice_area, jurisdiction)
                if lessons:
                    save_memory(practice_area, jurisdiction, lessons)
        except Exception as mem_err:
            print(f"[EDITORIAL MEMORY] Warning: Could not save memory: {mem_err}")

        # Validate serialization before returning
        json.dumps(response_data, default=str, ensure_ascii=False)
        return response_data
    except (TypeError, ValueError, UnicodeError) as e:
        print(f"[SERIALIZATION ERROR] Failed to serialize response: {e}")
        # Fallback: force ASCII serialization
        safe_response = json.loads(json.dumps(response_data, default=str, ensure_ascii=True))
        return safe_response


# =============================================================================
# v18.0: ASYNC PROCESSING — Fire-and-forget with webhook callback
# Vercel Hobby has a 300s function timeout. Pipeline takes 8-15 min.
# Solution: Return immediately, run pipeline in background, call webhook when done.
# =============================================================================

PIPELINE_PROGRESS = {
    "ingestion": (7, "Preparing the document"),
    "extraction": (15, "Identifying matters and lawyers"),
    "evidence_reconciliation": (22, "Checking the matter register against the file"),
    "pre_flight": (27, "Checking document integrity"),
    "context_engine": (33, "Analyzing the submission context"),
    "practice_intelligence": (39, "Reviewing the practice and jurisdiction"),
    "comprehension": (44, "Building the editorial reading"),
    "identity_discovery": (49, "Defining the competitive position"),
    "hypothesis_construction": (54, "Evaluating the recognition thesis"),
    "refutation_engine": (59, "Testing the thesis against the evidence"),
    "comparative_analysis": (64, "Comparing strengths and evidence gaps"),
    "editorial_confidence": (69, "Calculating editorial confidence"),
    "submission_blueprint": (74, "Designing the submission structure"),
    "narrative_architecture": (79, "Organizing the strategic narrative"),
    "analysis": (83, "Drafting the strategic assessment"),
    "evidence_gap_analysis": (86, "Locating evidence gaps"),
    "optimization": (90, "Optimizing each matter against its evidence"),
    "artifact_validation": (95, "Validating every matter against the source"),
    "constitutional_validation": (97, "Running the final quality review"),
    "writing": (99, "Preparing the deliverables"),
    "interrogation": (99, "Preparing evidence questions"),
}


def _estimate_pipeline_minutes(matter_count: int) -> int:
    """Estimate after removing per-matter grammar and preservation retries."""
    if matter_count <= 0:
        return 18
    return max(10, min(45, round(7 + (matter_count * 0.7))))


def _send_progress_callback(sync_requests, callback_url: str, webhook_secret: str,
                            submission_id: str, run_id: str, node_name: str, state: dict,
                            progress: int, started_at: float) -> None:
    matters = state.get("matters") if isinstance(state, dict) else []
    matter_count = len(matters) if isinstance(matters, list) else 0
    _, stage_label = PIPELINE_PROGRESS.get(
        node_name, (progress, "Processing the document")
    )
    estimated_minutes = _estimate_pipeline_minutes(matter_count)
    try:
        response = sync_requests.post(
            callback_url,
            json={
                "secret": webhook_secret,
                "submission_id": submission_id,
                "run_id": run_id,
                "pipeline_progress": {
                    "progress": progress,
                    "stage": node_name,
                    "stage_label": stage_label,
                    "matter_count": matter_count,
                    "estimated_total_minutes": estimated_minutes,
                    "elapsed_seconds": int(time.time() - started_at),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
            },
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        if response.status_code >= 400:
            print(
                f"[PIPELINE PROGRESS] Callback rejected for {submission_id}/{run_id}: "
                f"{response.status_code}"
            )
    except Exception as progress_err:
        # Progress telemetry must never stop the actual pipeline.
        print(f"[PIPELINE PROGRESS] Non-fatal callback error: {progress_err}")


def _run_pipeline_sync(initial_state: dict, config: dict, context: dict,
                       thread_id: str, submission_id: str, run_id: str,
                       callback_url: str, webhook_secret: str):
    """
    Synchronous function that runs the full LangGraph pipeline and 
    POSTs results to the Vercel webhook when complete.
    Called via asyncio.to_thread() to avoid blocking the event loop.
    """
    import requests as sync_requests

    try:
        started_at = time.time()
        print(f"[ASYNC PIPELINE] Starting pipeline for thread {thread_id}...")
        _send_progress_callback(
            sync_requests, callback_url, webhook_secret, submission_id, run_id,
            "ingestion", initial_state, 3, started_at,
        )

        # Stream full state snapshots so the UI receives real node-level
        # progress. The final values snapshot is identical to invoke() output.
        result = initial_state
        pending_node = ""
        last_progress = 3
        for stream_mode, payload in graph_app.stream(
            initial_state,
            config,
            stream_mode=["updates", "values"],
        ):
            if stream_mode == "updates" and isinstance(payload, dict) and payload:
                pending_node = next(iter(payload.keys()))
                continue
            if stream_mode != "values" or not isinstance(payload, dict):
                continue
            result = payload
            if not pending_node:
                continue
            node_progress = PIPELINE_PROGRESS.get(pending_node, (last_progress, ""))[0]
            last_progress = max(last_progress, node_progress)
            _send_progress_callback(
                sync_requests, callback_url, webhook_secret, submission_id, run_id,
                pending_node, result, last_progress, started_at,
            )
            pending_node = ""

        _assert_release_approved(result)
        print(f"[ASYNC PIPELINE] Pipeline completed for thread {thread_id}")

        # Build response data (same logic as /process endpoint)
        messages = result.get("messages", [])
        response_text = "No response generated."
        if messages:
            last_msg = messages[-1]
            if hasattr(last_msg, "content"):
                response_text = sanitize_unicode(coerce_message_text(last_msg.content))
            elif isinstance(last_msg, tuple) and len(last_msg) > 1:
                response_text = sanitize_unicode(str(last_msg[1]))
            else:
                response_text = sanitize_unicode(str(last_msg))

        response_data = {
            "status": "completed" if result.get("is_complete") else "interrogating",
            "thread_id": thread_id,
            "data": {
                "pdf_url": result.get("pdf_url"),
                "is_complete": result.get("is_complete", False),
                "response": response_text,
                "metadata": result.get("metadata", {}),
                "matters": result.get("matters", []),
                "analysis": result.get("analysis", {}),
                "strategic_context": result.get("strategic_context", {}),
                "comprehension": result.get("comprehension", {}),
                "competitive_identity": result.get("competitive_identity", {}),
                "hypotheses": result.get("hypotheses", []),
                "refutation_results": result.get("refutation_results", {}),
                "comparative_analysis": result.get("comparative_analysis", {}),
                "editorial_confidence": result.get("editorial_confidence", {}),
                "narrative_architecture": result.get("narrative_architecture", {}),
                "submission_blueprint": result.get("submission_blueprint", {}),
                "reasoning_trace": result.get("reasoning_trace", []),
                "pipeline_manifest": result.get("pipeline_manifest", {}),
                "enhanced_b7": result.get("enhanced_b7", ""),
                "enhanced_c2": result.get("enhanced_c2", ""),
                "canonical_submission": result.get("canonical_submission", {}),
                "strategic_objective": result.get("strategic_objective", {}),
                "gaps": result.get("gaps", []),
                "interrogation_questions": result.get("interrogation_questions", []),
                "optimized_submission": result.get("optimized_submission", {}),
                "strategic_audit": result.get("strategic_audit", {}),
                "artifact_validation": result.get("artifact_validation", {}),
                "matter_evidence_gaps": result.get("matter_evidence_gaps", {}),
                "evidence_reconciliation": result.get("evidence_reconciliation", {}),
                "source_validation": result.get("source_validation", {}),
                "constitutional_validation": result.get("constitutional_validation", {}),
                "release_verdict": result.get("release_verdict", {}),
            }
        }

        # =====================================================
        # v19.0: CLONE-AND-REPLACE DOCX GENERATION
        # Clone the original DOCX and replace only B10 + E2/D2
        # with AI-enhanced content. Preserves ALL formatting.
        # =====================================================
        try:
            from urllib.parse import urlparse
            file_path = result.get("file_path", "")
            enhanced_b7 = result.get("enhanced_b7", "")
            enhanced_c2 = result.get("enhanced_c2", "")
            matters = result.get("matters", [])
            
            hero_matter = (
                result.get("hero_matter")
                or (result.get("submission_blueprint", {}).get("hero_matter") if isinstance(result.get("submission_blueprint"), dict) else "")
                or (result.get("analysis", {}).get("hero_matter") if isinstance(result.get("analysis"), dict) else "")
                or ""
            )
            
            source_extension = os.path.splitext(urlparse(file_path).path)[1].lower()
            docx_bytes = None
            if source_extension == ".docx":
                docx_bytes = clone_and_replace_from_state(
                    file_path=file_path,
                    enhanced_b7=enhanced_b7,
                    matters=matters,
                    enhanced_c2=enhanced_c2,
                    hero_matter=hero_matter,
                )

            if source_extension == ".docx" and docx_bytes:
                ooxml_errors = validate_docx_ooxml(docx_bytes)
                if ooxml_errors:
                    raise ValueError("DOCX OOXML validation failed: " + "; ".join(ooxml_errors))
                # Base64 encode the DOCX for transport via webhook
                docx_b64 = base64.b64encode(docx_bytes).decode('utf-8')
                response_data["data"]["cloned_docx_b64"] = docx_b64
                response_data["data"]["release_verdict"] = {
                    **response_data["data"]["release_verdict"],
                    "docx_clone_passed": True,
                    "ooxml_validation_passed": True,
                    "delivery_mode": "source_clone",
                }
                print(f"[DOCX CLONER] ✅ Generated cloned DOCX: {len(docx_bytes)} bytes")
            elif source_extension == ".doc":
                # Legacy binary Word cannot be cloned safely without changing
                # its container. The callback persists canonical data and the
                # TypeScript `docx` builder creates a new positive-DXA OOXML
                # package at download time.
                response_data["data"]["release_verdict"] = {
                    **response_data["data"]["release_verdict"],
                    "delivery_mode": "canonical_docx_builder",
                    "builder_contract_passed": True,
                    "source_format": "doc",
                }
                print("[DOCX BUILDER] Legacy .doc approved for canonical DXA DOCX builder")
            else:
                raise ValueError(
                    f"No approved DOCX delivery path for source format {source_extension or 'unknown'}"
                )
        except Exception as docx_err:
            print(f"[DOCX CLONER] ⚠️ Clone-and-replace warning: {docx_err}. Falling back to canonical DOCX builder.")
            response_data["data"]["release_verdict"] = {
                **response_data["data"].get("release_verdict", {}),
                "delivery_mode": "canonical_docx_builder",
                "builder_contract_passed": True,
                "docx_clone_warning": str(docx_err),
            }

        # Apply epistemic language guard
        response_data["data"] = filter_pipeline_output(response_data["data"])

        # Save editorial memory
        try:
            practice_area = context.get("practice_area", "")
            jurisdiction = context.get("jurisdiction", "")
            if practice_area and jurisdiction:
                lessons = extract_lessons_from_result(response_data["data"], practice_area, jurisdiction)
                if lessons:
                    save_memory(practice_area, jurisdiction, lessons)
        except Exception as mem_err:
            print(f"[EDITORIAL MEMORY] Warning: Could not save memory: {mem_err}")

        # Validate serialization
        json.dumps(response_data, default=str, ensure_ascii=False)

        # POST results to Vercel webhook
        print(f"[ASYNC PIPELINE] Sending results to webhook: {callback_url}")
        webhook_response = sync_requests.post(
            callback_url,
            json={
                "secret": webhook_secret,
                "submission_id": submission_id,
                "run_id": run_id,
                "pipeline_result": response_data,
            },
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        print(f"[ASYNC PIPELINE] Webhook response: {webhook_response.status_code}")

    except Exception as e:
        error_msg = traceback.format_exc()
        print(f"[ASYNC PIPELINE ERROR] Thread {thread_id}: {error_msg}")

        # Notify webhook of failure so the submission gets marked as Error
        try:
            sync_requests.post(
                callback_url,
                json={
                    "secret": webhook_secret,
                    "submission_id": submission_id,
                    "run_id": run_id,
                    "pipeline_error": {
                        "code": e.code if isinstance(e, PipelineReleaseError) else "PIPELINE_EXECUTION_ERROR",
                        "message": str(e),
                        "details": e.details if isinstance(e, PipelineReleaseError) else error_msg[:2000],
                    },
                },
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
        except Exception as cb_err:
            print(f"[ASYNC PIPELINE] Failed to notify webhook of error: {cb_err}")


@api.post("/process-async")
async def process_document_async(request: Request):
    """
    v18.0: Async version of /process.
    Returns immediately with {"status": "accepted"}.
    Runs pipeline in background thread, then POSTs results to callback_url.
    """
    try:
        data = await request.json()
    except Exception as e:
        return JSONResponse(status_code=400, content={
            "error": "Invalid JSON in request body",
            "error_code": "INVALID_REQUEST",
            "details": str(e)
        })

    user_input = data.get("user_input")
    thread_id = data.get("thread_id")
    submission_id = data.get("submission_id") or thread_id
    run_id = data.get("run_id") or thread_id
    is_file = data.get("is_file", False)
    context = data.get("context", {})
    callback_url = data.get("callback_url")
    webhook_secret = data.get("webhook_secret", "")

    if not user_input or not thread_id or not submission_id or not callback_url:
        return JSONResponse(status_code=400, content={
            "error": "Missing user_input, thread_id, or callback_url",
            "error_code": "MISSING_PARAMS"
        })

    config = {"configurable": {"thread_id": thread_id}}
    sanitized_input = sanitize_unicode(user_input) if not is_file else user_input

    initial_state = {
        "file_path": user_input if is_file else "",
        "doc_text": sanitized_input if not is_file else "",
        "messages": [HumanMessage(content="Please process this submission document.")],
        "metadata": {},
        "matters": [],
        "analysis": {},
        "latex_code": "",
        "confidence_score": 0.0,
        "is_complete": False,
        "pdf_url": "",
        "submission_context": context,
        "strategic_context": {},
        "comprehension": {},
        "competitive_identity": {},
        "hypotheses": [],
        "refutation_results": {},
        "comparative_analysis": {},
        "editorial_confidence": {},
        "narrative_architecture": {},
        "submission_blueprint": {},
        "evidence_map": {},
        "reasoning_trace": [],
        "editorial_memory": "",
        "current_step": "ingestion",
        "pipeline_manifest": {},
        "source_validation": {},
        "release_verdict": {},
        "canonical_submission": {},
        "strategic_objective": {},
        "evidence_ledger": {},
        "gaps": [],
        "interrogation_questions": [],
        "evidence_reconciliation": {},
        "requires_user_input": False,
        "optimized_submission": {},
        "strategic_audit": {},
        "artifact_validation": {},
        "matter_evidence_gaps": {},
        "original_b10": "",
        "original_c2": "",
        "enhanced_b7": "",
    }

    # Load editorial memory
    try:
        practice_area = context.get("practice_area", "")
        jurisdiction = context.get("jurisdiction", "")
        if practice_area and jurisdiction:
            memory_bank = load_memory(practice_area, jurisdiction)
            editorial_memory_context = format_memory_for_prompt(memory_bank)
            if editorial_memory_context:
                initial_state["editorial_memory"] = editorial_memory_context
                print(f"[EDITORIAL MEMORY] Loaded {memory_bank.total_submissions_processed} past submissions for {practice_area}/{jurisdiction}")
    except Exception as e:
        print(f"[EDITORIAL MEMORY] Warning: Could not load memory: {e}")

    # Launch pipeline in background thread (graph_app.invoke is synchronous)
    asyncio.get_event_loop().run_in_executor(
        None,
        _run_pipeline_sync,
        initial_state, config, context, thread_id, submission_id, run_id,
        callback_url, webhook_secret
    )

    print(f"[ASYNC PIPELINE] Accepted job for thread {thread_id}, will callback to {callback_url}")
    return JSONResponse(status_code=202, content={
        "status": "accepted",
        "thread_id": thread_id,
        "message": "Pipeline started in background. Results will be sent to callback_url."
    })

@api.post("/generate-report")
async def generate_report_endpoint(request: Request):
    """
    Genera un PDF compilado recibiendo el array de matters ya optimizados desde Next.js
    """
    data = await request.json()
    thread_id = data.get("submission_id", str(uuid.uuid4()))
    
    # Construimos un state manual para el writer_node
    state = {
        "metadata": data.get("metadata", {}),
        "matters": data.get("matters", []),
        "analysis": data.get("analysis", {"confidence_score": 100})
    }
    config = {"configurable": {"thread_id": thread_id}}
    
    # Llamamos directamente al writer_node
    result = writer_node(state, config)
    
    return {
        "success": result.get("is_complete", False),
        "pdf_url": os.path.abspath(result.get("pdf_url")) if result.get("pdf_url") else None,
        "latex_code": result.get("latex_code")
    }

@api.post("/generate-docx")
async def generate_docx_endpoint(request: Request):
    """
    Genera un archivo DOCX directamente usando python-docx.
    """
    data = await request.json()
    thread_id = data.get("submission_id", str(uuid.uuid4()))
    
    structured_data = {
        "firm_metadata": data.get("metadata", {}),
        "matters": data.get("matters", []),
        "chambersData": data.get("chambersData", {})
    }
    
    doc_type = data.get("doc_type", "audit")
    
    # Generate the docx
    filename = f"report_{thread_id}_{doc_type}"
    try:
        file_path = generate_docx_report(structured_data, filename, doc_type)
        return {
            "success": True,
            "docx_url": os.path.abspath(file_path)
        }
    except Exception as e:
        print(f"Error generating DOCX: {e}")
        return {"success": False, "error": str(e)}

@api.get("/download")
async def download_file(filepath: str):
    """
    Permite descargar el archivo PDF o DOCX generado físicamente.
    """
    if os.path.exists(filepath):
        if filepath.endswith('.pdf'):
            return FileResponse(filepath, media_type='application/pdf', filename=os.path.basename(filepath))
        elif filepath.endswith('.docx'):
            return FileResponse(filepath, media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename=os.path.basename(filepath))
    return {"error": "File not found"}


@api.post("/optimize/b10")
async def optimize_b10_endpoint(request: Request):
    """
    Endpoint de micro-optimización de 3 segundos para la Sección B10 (narrativa departamental).
    """
    try:
        data = await request.json()
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON", "details": str(e)})

    from agents.micro_optimizer import optimize_b10_micro

    result = optimize_b10_micro(
        original_b10=data.get("original_b10", ""),
        practice_area=data.get("practice_area", ""),
        firm_name=data.get("firm_name", ""),
        directive=data.get("directive", ""),
        strategic_context=data.get("strategic_context"),
        narrative_architecture=data.get("narrative_architecture")
    )
    status_code = 200 if result.get("success") else 400
    return JSONResponse(status_code=status_code, content=result)


@api.post("/optimize/matter")
async def optimize_matter_endpoint(request: Request):
    """
    Endpoint de micro-optimización de 3 segundos para un Asunto individual.
    """
    try:
        data = await request.json()
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON", "details": str(e)})

    from agents.micro_optimizer import optimize_matter_micro

    result = optimize_matter_micro(
        matter=data.get("matter", {}),
        directive=data.get("directive", ""),
        practice_area=data.get("practice_area", ""),
        firm_name=data.get("firm_name", ""),
        thesis=data.get("thesis", "")
    )
    status_code = 200 if result.get("success") else 400
    return JSONResponse(status_code=status_code, content=result)


@api.post("/extract")
async def extract_document_endpoint(request: Request):
    """
    Fast extraction endpoint (<1s deterministic, or fallback to extraction_node).
    Extracts firm metadata, lawyers, department narrative B10, and all matters
    directly into structured format for immediate preview in Submission Studio.
    """
    try:
        data = await request.json()
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON", "details": str(e)})

    user_input = data.get("user_input") or data.get("documentUrl") or data.get("text") or ""
    context = data.get("context", {})

    if not user_input:
        return JSONResponse(status_code=400, content={"error": "Missing user_input (URL, file path, or text)"})

    is_url = user_input.startswith("http://") or user_input.startswith("https://")
    is_file = is_url or (isinstance(user_input, str) and (user_input.endswith(".docx") or user_input.endswith(".doc") or user_input.endswith(".pdf") or os.path.exists(user_input)))

    try:
        from utils.doc_parser import DocumentParser
        from agents.nodes import sanitize_text

        # 1. Parse document text
        if is_file:
            doc_text = DocumentParser.parse(user_input)
        else:
            doc_text = user_input
        doc_text = sanitize_text(doc_text)

        # 2. Extract deterministic metadata and sections
        prelim = DocumentParser.extract_chambers_preliminary_fields(doc_text)
        heads = DocumentParser.extract_department_heads(doc_text)
        roster = DocumentParser.extract_lawyer_roster(doc_text)
        original_c2 = DocumentParser.extract_c2_source(doc_text)

        # Extract B10 narrative
        original_b10 = ""
        b10_match = re.search(
            r'B(?:10|7)\s+What is this department best known for.*?\n',
            doc_text, re.IGNORECASE
        )
        if b10_match:
            start_idx = b10_match.end()
            end_match = re.search(
                r'\n\s*(?:C1\s|C\.\s|D\.\s|B8\s|B9\s|Publishable|CONFIDENTIAL)',
                doc_text[start_idx:], re.IGNORECASE
            )
            if end_match:
                original_b10 = doc_text[start_idx:start_idx + end_match.start()].strip()
            else:
                original_b10 = doc_text[start_idx:start_idx + 3000].strip()

            original_b10 = re.sub(
                r'(?:Please include:.*?word count limit\)?|Address any feedback.*?word count limit\)?)',
                '', original_b10, flags=re.IGNORECASE | re.DOTALL
            ).strip()

        # Extract numbered matters deterministically
        sections = DocumentParser.extract_numbered_matter_sections(doc_text)
        matters = []

        if sections:
            for label_key, sec in sections.items():
                fields = DocumentParser.extract_matter_fields(sec["text"])
                is_conf = "confidential" in label_key or "non-publishable" in label_key
                matters.append({
                    "id": f"matter-ext-{len(matters) + 1}",
                    "name": sec["label"],
                    "title": sec["label"],
                    "client": fields.get("client", ""),
                    "value": fields.get("matter_value", ""),
                    "leadPartner": fields.get("lead_partner", ""),
                    "lead_partner": fields.get("lead_partner", ""),
                    "rawNotes": fields.get("summary", ""),
                    "summary": fields.get("summary", ""),
                    "teamMembers": fields.get("team_members", ""),
                    "team_members": fields.get("team_members", ""),
                    "crossBorder": fields.get("cross_border_jurisdictions", ""),
                    "otherFirms": fields.get("other_firms", ""),
                    "completionDate": fields.get("completion_date", ""),
                    "isConfidential": is_conf,
                    "publish_status": "non_publishable" if is_conf else "publishable",
                    "optimizedText": "",
                })
        else:
            # Fallback to extraction_node if no standard numbered headers found
            from agents.nodes import extraction_node
            state = {
                "file_path": user_input if is_file else "",
                "doc_text": doc_text,
                "messages": [],
                "pipeline_manifest": {
                    "document": {
                        "source_matters": {"total": 0, "matter_labels": []}
                    }
                }
            }
            extract_res = extraction_node(state)
            ext_matters = extract_res.get("matters", [])
            for idx, m in enumerate(ext_matters):
                is_conf = m.get("is_confidential", False) or m.get("publish_status") in ("non_publishable", "confidential")
                matters.append({
                    "id": f"matter-ext-{idx + 1}",
                    "name": m.get("title") or f"Matter {idx + 1}",
                    "title": m.get("title") or f"Matter {idx + 1}",
                    "client": m.get("client", ""),
                    "value": m.get("matter_value", ""),
                    "leadPartner": m.get("lead_partner", ""),
                    "lead_partner": m.get("lead_partner", ""),
                    "rawNotes": m.get("summary", ""),
                    "summary": m.get("summary", ""),
                    "teamMembers": m.get("team_members", ""),
                    "team_members": m.get("team_members", ""),
                    "crossBorder": m.get("cross_border_jurisdictions", ""),
                    "otherFirms": m.get("other_firms", ""),
                    "completionDate": m.get("completion_date", ""),
                    "isConfidential": is_conf,
                    "publish_status": "non_publishable" if is_conf else "publishable",
                    "optimizedText": "",
                })
            if not prelim.get("firm_name"):
                prelim = extract_res.get("metadata", {})

        firm_name = prelim.get("firm_name") or context.get("firm_name") or ""
        practice_area = prelim.get("practice_area") or context.get("practice_area") or ""
        location = prelim.get("location") or context.get("jurisdiction") or ""

        return JSONResponse(status_code=200, content={
            "success": True,
            "metadata": {
                "firm_name": firm_name,
                "practice_area": practice_area,
                "location": location,
            },
            "department": {
                "department_heads": [{"name": h, "email": "", "phone": ""} for h in heads],
            },
            "lawyers": roster,
            "original_b10": original_b10,
            "original_c2": original_c2,
            "matters": matters,
            "total_matters": len(matters),
            "publishable_count": sum(1 for m in matters if not m.get("isConfidential")),
            "confidential_count": sum(1 for m in matters if m.get("isConfidential")),
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": str(e),
            "details": traceback.format_exc()[:1500]
        })


