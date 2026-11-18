import os
import re
import json
import asyncio
import logging
import hmac
from utils.engine_identity import engine_fingerprint
from utils.review_policy import REVIEW_POLICY_VERSION

logger = logging.getLogger(__name__)
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


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

@api.middleware("http")
async def service_boundary(request: Request, call_next):
    # Legacy full-generation entry points cannot publish with different rules.
    # Retired 21-node full-generation graph (removed v1.0.95); Studio uses core.review_graph.
    if request.url.path in ('/process', '/process-async', '/download', '/generate-report', '/generate-docx'):
        return JSONResponse(status_code=410, content={'code':'STUDIO_REQUIRED','error':'Use Submission Studio and its durable editorial jobs.'})
    if request.url.path not in ('/', '/health'):
        expected=os.environ.get('AI_ENGINE_SERVICE_TOKEN', '')
        supplied=request.headers.get('authorization', '').removeprefix('Bearer ')
        if expected and not hmac.compare_digest(supplied, expected):
            return JSONResponse(status_code=401, content={'error':'Service authentication required'})
        if not expected and os.environ.get('RENDER'):
            return JSONResponse(status_code=503, content={'error':'Service authentication is not configured'})
    from utils.provider_budget import request_budget, RequestBudget
    allowance=request.headers.get('x-rankpilot-token-allowance')
    if allowance is not None and (not allowance.isdecimal() or len(allowance)>12):
        return JSONResponse(status_code=400,content={'error':'Invalid editorial allowance'})
    # Uncapped requests still track usage and stop on an uncertain provider outcome.
    budget_token=request_budget.set(RequestBudget(int(allowance) if allowance is not None else None))
    try:
        response=await call_next(request)
    finally:
        request_budget.reset(budget_token)
    response.headers["X-RankPilot-Policy"]=REVIEW_POLICY_VERSION
    return response

@api.get("/")
def read_root():
    return {
        "status": "online",
        "service": "RankPilot Core Engine",
        "version": "rankpilot-pipeline-v3.3",
        "commit": os.environ.get("RENDER_GIT_COMMIT", "local"),
        "engine_fingerprint": engine_fingerprint(),
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
        "version": "rankpilot-pipeline-v3.3",
        "commit": os.environ.get("RENDER_GIT_COMMIT", "local"),
        "engine_fingerprint": engine_fingerprint(),
        "environment": "Ubuntu/Docker"
    }

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

    result = await asyncio.to_thread(optimize_b10_micro,
        original_b10=data.get("original_b10", ""),
        practice_area=data.get("practice_area", ""),
        firm_name=data.get("firm_name", ""),
        directive=data.get("directive", ""),
        strategic_context=data.get("strategic_context"),
        narrative_architecture=data.get("narrative_architecture"),
        directory=data.get("directory", ""),
        jurisdiction=data.get("jurisdiction", "")
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

    result = await asyncio.to_thread(optimize_matter_micro,
        matter=data.get("matter", {}),
        directive=data.get("directive", ""),
        practice_area=data.get("practice_area", ""),
        firm_name=data.get("firm_name", ""),
        thesis=data.get("thesis", ""),
        directory=data.get("directory", ""),
        jurisdiction=data.get("jurisdiction", "")
    )
    status_code = 200 if result.get("success") else 400
    return JSONResponse(status_code=status_code, content=result)


async def _extract_readable_source(doc_text, context):
    from utils.doc_parser import DocumentParser
    from utils.document_preflight import SourceError
    from agents.nodes import sanitize_text
    doc_text = sanitize_text(doc_text.replace("\x07", " | "))
    source_errors = []
    empty_sections = []
    try:
        # Repeated numbering is recoverable when the original blocks differ.
        # Preserve each literal block and its original heading independently.
        labels = DocumentParser._count_matter_labels_in_text(doc_text)
        if labels['label_validation'].get('duplicate_labels'):
            blocks=list(DocumentParser.extract_numbered_matter_sections(doc_text).values())
            identities=[(b.get('source_heading','').casefold(),' '.join(b['text'].split()).casefold()) for b in blocks]
            if len(identities)!=len(set(identities)):
                raise SourceError('SOURCE_DUPLICATE_LABELS')
        # Extract deterministic metadata and sections
        from utils.filing_extraction import extract_filing_fields
        filing = extract_filing_fields(doc_text)
        prelim = DocumentParser.extract_chambers_preliminary_fields(doc_text)
        heads = DocumentParser.extract_department_heads(doc_text)
        roster = DocumentParser.extract_lawyer_roster(doc_text)
        original_c2 = DocumentParser.extract_c2_source(doc_text)

        # Extract B10 narrative
        original_b10 = ""
        b10_match = re.search(
            r'(?:B(?:10|7)\s+)?What is (?:this|your) department best known for[^\n]*\n',
            doc_text, re.IGNORECASE
        )
        if b10_match:
            start_idx = b10_match.end()
            rem = doc_text[start_idx:]
            sub_m = re.match(r'^\s*Specific expertise[^\n]*\n', rem, re.I)
            if sub_m:
                rem = rem[sub_m.end():]
            end_match = re.search(
                r'\n\s*(?:How many new cases|Significant client feedback|Client feedback|Company\s*\||C1\s|C2\s|C\.\s|D\.\s|B8\s|B9\s|B11\s|Publishable|CONFIDENTIAL|MATTER NUMBER)',
                rem, re.IGNORECASE
            )
            if end_match:
                original_b10 = rem[:end_match.start()].strip()
            else:
                original_b10 = rem.strip()

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
                if not any(str(fields.get(key) or '').strip() for key in ('client', 'summary', 'matter_value', 'lead_partner', 'team_members', 'completion_date')):
                    empty_sections.append(sec['label'])
                    continue
                if not str(fields.get('summary') or '').strip() and not context.get('reconcile_source'):
                    raise SourceError('SOURCE_INCOMPLETE_MATTERS', matters=[sec['label']])
                conf_status = sec.get("confidentiality_status") or "confirmation_required"
                is_unconfirmed = conf_status == "confirmation_required"
                is_conf = conf_status != "publishable"
                source_heading = sec.get("source_heading") or sec["label"]
                display_label = re.sub(r'(?i)^(?:Publishable|Confidential|Non[- ]publishable)\s+', '', sec["label"]) if is_unconfirmed else sec["label"]
                if conf_status == "confidential":
                    display_label = re.sub(r'(?i)^Publishable', 'Confidential', display_label)

                c_name = re.sub(r'(?i)^\s*(?:client name,?\s*give a general description\.?|\(?or if you cannot reveal the client name[^\)]*\)?\.?)\s*', '', fields.get("client", "")).strip()
                c_name = c_name.strip('|\n\r\t ')
                cb_val = re.sub(r'(?i)^\s*(?:jurisdictions involved\.?|please name the jurisdictions involved\.?)\s*', '', fields.get("cross_border_jurisdictions", "")).strip()
                matters.append({
                    "id": f"matter-ext-{len(matters) + 1}",
                    "name": display_label,
                    "title": display_label,
                    "client": c_name,
                    "value": fields.get("matter_value", ""),
                    "leadPartner": fields.get("lead_partner", ""),
                    "lead_partner": fields.get("lead_partner", ""),
                    "rawNotes": fields.get("summary", ""),
                    "summary": fields.get("summary", ""),
                    "teamMembers": fields.get("team_members", ""),
                    "team_members": fields.get("team_members", ""),
                    "crossBorder": cb_val,
                    "otherFirms": fields.get("other_firms", ""),
                    "completionDate": fields.get("completion_date", ""),
                    "isConfidential": is_conf,
                    "confidentialityStatus": conf_status,
                    "confidentialityConfirmed": not is_unconfirmed,
                    "publish_status": "confirmation_required" if is_unconfirmed else ("non_publishable" if is_conf else "publishable"),
                    "valueConflict": fields.get("value_conflict") or "",
                    "source_excerpt": sec["text"],
                    "source_label": sec["label"],
                    "source_heading": source_heading,
                    "source_occurrence": sec.get("source_occurrence"),
                    "confidentialityEvidence": sec.get("confidentiality_evidence"),
                    "optimizedText": "",
                })
        elif not context.get('reconcile_source'):
            # Fallback to extraction_node if no standard numbered headers found
            from agents.nodes import extraction_node
            state = {
                "file_path": "",
                "doc_text": doc_text,
                "submission_context": context,
                "messages": [],
                "pipeline_manifest": {
                    "document": {
                        "source_matters": {"total": None, "count_status": "unknown", "matter_labels": []}
                    }
                }
            }
            extract_res = extraction_node(state)
            if extract_res.get("extraction_error"):
                return JSONResponse(status_code=502, content={"success": False, "code": "EXTRACTION_PROVIDER_ERROR", "error": "Extraction failed. Your draft has not been replaced. Please retry.", "source_errors": source_errors})
            ext_matters = extract_res.get("matters", [])
            for idx, m in enumerate(ext_matters):
                excerpt = str(m.get('source_excerpt') or '').strip()
                normalize = lambda value: ' '.join(str(value).split()).casefold()
                if not excerpt or normalize(excerpt) not in normalize(doc_text) or any(normalize(m.get(field, '')) not in normalize(excerpt) for field in ('client', 'matter_value', 'lead_partner') if m.get(field)):
                    raise SourceError('SOURCE_UNGROUNDED_MATTERS', matters=[m.get('title') or str(idx + 1)])
                # The wizard must show literal evidence, not a model's paraphrase.
                m['summary'] = excerpt
                is_conf = m.get("is_confidential", False) or m.get("publish_status") in ("non_publishable", "confidential")
                conf_status = m.get("confidentiality_status") or ("confirmation_required" if m.get("publish_status") == "confirmation_required" else ("confidential" if is_conf else ("publishable" if m.get("publish_status") == "publishable" else "confirmation_required")))
                is_unconfirmed = (conf_status == "confirmation_required")
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
                    "confidentialityStatus": conf_status,
                    "confidentialityConfirmed": not is_unconfirmed,
                    "publish_status": "confirmation_required" if is_unconfirmed else ("non_publishable" if is_conf else "publishable"),
                    "valueConflict": m.get("value_conflict") or "",
                    "source_excerpt": m.get("source_excerpt") or "",
                    "source_label": m.get("source_label") or "",
                    "optimizedText": "",
                })
            extracted_metadata = extract_res.get("metadata", {})
            from utils.filing_extraction import merge_model_filing_fields
            filing = merge_model_filing_fields(filing, extracted_metadata.get("filing_findings", []), doc_text)
            prelim = {**extracted_metadata, **{k: v for k, v in prelim.items() if v}}
            if not roster:
                roster = extracted_metadata.get("lawyers", [])
            if not heads:
                heads = [h.get("name", "") for h in extracted_metadata.get("department", {}).get("department_heads", []) if h.get("name")]

        reconciliation = {}
        if context.get('reconcile_source'):
            from utils.source_reconciliation import reconcile_source, VERSION as reconciliation_version
            try:
                reviewed = await asyncio.to_thread(reconcile_source, doc_text, matters, filing, lawyers=roster)
                matters = reviewed['matters']
                roster = reviewed['lawyers']
                admin = reviewed['administration']
                prelim = {
                    'firm_name': admin['firm_name'] or prelim.get('firm_name', ''),
                    'practice_area': admin['practice_area'] or prelim.get('practice_area', ''),
                    'location': admin['location'] or prelim.get('location', '')
                }
                original_b10 = admin['original_b10'] if admin.get('original_b10') else original_b10
                original_c2 = admin['original_c2'] if admin.get('original_c2') else original_c2
                filing = {k: reviewed[k] for k in ('filing_details', 'filing_evidence', 'filing_field_status')}
                reconciliation = {k: reviewed[k] for k in ('source_reconciliation', 'administration_evidence', 'administration_issues')}
                if original_b10:
                    admin_ev = reconciliation.setdefault('administration_evidence', {})
                    b10_ev = admin_ev.setdefault('original_b10', {})
                    if b10_ev.get('status') != 'found' or not b10_ev.get('quotes'):
                        b10_ev['status'] = 'found'
                        b10_ev['quotes'] = [original_b10]
                if original_c2:
                    admin_ev = reconciliation.setdefault('administration_evidence', {})
                    c2_ev = admin_ev.setdefault('original_c2', {})
                    if c2_ev.get('status') != 'found' or not c2_ev.get('quotes'):
                        c2_ev['status'] = 'found'
                        c2_ev['quotes'] = [original_c2]
            except Exception as error:
                logger.exception('Full source reconciliation failed; recorded usage=%s', getattr(error, 'usage', {}))
                if not matters:
                    return JSONResponse(status_code=502, content={'success': False, 'code': 'SOURCE_RECONCILIATION_UNAVAILABLE', 'usage': getattr(error, 'usage', {}), 'retryable': False})
                logger.warning('Proceeding with clean deterministic extraction fallback since %d matters were extracted', len(matters))
                reconciliation = {
                    'source_reconciliation': {
                        'version': reconciliation_version,
                        'status': 'fallback_deterministic',
                        'source_characters': len(doc_text),
                        'covered_characters': len(doc_text),
                        'matters_reviewed': len(matters),
                        'notice': 'Extracción base completada; la conciliación secundaria no pudo completarse.',
                        'warning': 'La conciliación secundaria por IA no alteró la extracción base.',
                        'error_detail': str(error),
                        'usage': getattr(error, 'usage', {}),
                        'usage_status': 'partial_unknown' if getattr(error, 'usage', {}).get('unknown_calls') else 'reported' if 'total_tokens' in getattr(error, 'usage', {}) else 'unknown',
                    }
                }
        elif context.get('reconcile_filing'):
            from utils.filing_reconciliation import reconcile_filing
            try:
                filing = await asyncio.to_thread(reconcile_filing, doc_text, filing)
            except Exception:
                logger.exception('Administrative source reconciliation failed')
                return JSONResponse(status_code=502, content={'success': False, 'code': 'FILING_RECONCILIATION_UNAVAILABLE'})

        from utils.filing_extraction import clean_firm_name
        firm_name = clean_firm_name(prelim.get("firm_name") or context.get("firm_name") or "")
        raw_practice = prelim.get("practice_area") or ""
        if "SOURCE DOCUMENT" in raw_practice or raw_practice.startswith("===") or "END DOCUMENT" in raw_practice:
            raw_practice = ""
        calibrated_practice = context.get("practice_area") or context.get("practiceArea") or ""
        # Ramos 18-11: a blank template carried "Energy & Natural Resources" in
        # A1 (firm name) as well as A2. A practice label is not a firm identity
        # and must not raise SOURCE_IDENTITY_CONFLICT against the real firm.
        same = lambda a, b: bool(a and b) and re.sub(r'\W+', '', a).casefold() == re.sub(r'\W+', '', b).casefold()
        if same(firm_name, raw_practice) or same(firm_name, calibrated_practice):
            firm_name = ""
        practice_area = raw_practice or calibrated_practice
        location = prelim.get("jurisdiction") or prelim.get("location") or context.get("jurisdiction") or ""

        return JSONResponse(status_code=200, content={
            "success": True,
            "metadata": {
                "firm_name": firm_name,
                "practice_area": practice_area,
                "extracted_practice_area": raw_practice,
                "calibrated_practice_area": calibrated_practice,
                "location": location,
            },
            "department": {
                "department_heads": [{"name": h, "email": "", "phone": ""} for h in heads],
            },
            "lawyers": roster,
            "original_b10": original_b10,
            "original_c2": original_c2,
            "matters": matters,
            **filing,
            **reconciliation,
            "total_matters": len(matters),
            "source_errors": source_errors,
            "partial": False,
            "empty_sections": empty_sections,
            "publishable_count": sum(1 for m in matters if not m.get("isConfidential")),
            "confidential_count": sum(1 for m in matters if m.get("isConfidential")),
        })

    except SourceError:
        raise
    except Exception:
        logger.exception('Source extraction failed')
        return JSONResponse(status_code=502, content={'success': False, 'code': 'EXTRACTION_PROVIDER_ERROR'})


@api.post('/extract')
async def extract_document_endpoint(request: Request):
    from utils.doc_parser import DocumentParser
    from utils.document_preflight import SourceError, readable_text
    from urllib.parse import urlparse
    try:
        data = await request.json()
        if not isinstance(data, dict):
            raise ValueError()
        context = data.get('context') or {}
        sources = data.get('sources') or context.get('sources') or []
        user_input = data.get('user_input') or data.get('documentUrl') or data.get('text') or ''
        if not isinstance(context, dict) or not isinstance(sources, list) or not isinstance(user_input, str):
            raise ValueError()
        if not sources:
            if not user_input:
                raise ValueError()
            is_file = user_input.startswith(('http://', 'https://')) or os.path.isfile(user_input)
            sources = [{'url': user_input, 'name': os.path.basename(urlparse(user_input).path)}] if is_file else [{'text': user_input, 'name': 'Notas de origen'}]
        if any(not isinstance(source, dict) for source in sources):
            raise ValueError()
    except Exception:
        return JSONResponse(status_code=400, content={'success': False, 'code': 'SOURCE_REQUIRED'})

    # Read every source first. A failure stops the whole batch before model calls.
    prepared, reports, errors = [], [], []
    for index, source in enumerate(sources):
        name = str(source.get('name') or os.path.basename(urlparse(str(source.get('url') or '')).path) or f'Archivo {index + 1}')
        try:
            if source.get('url'):
                text, report = DocumentParser.parse_with_report(source['url'], name)
            else:
                text = readable_text(str(source.get('text') or ''))
                report = {'source': name, 'detected_format': 'text', 'method': 'user_notes', 'character_count': len(text)}
            if context.get('modality') == 'draft':
                from utils.source_scope import validate_draft_directory
                validate_draft_directory(text, str(context.get('directory') or ''))
            prepared.append((name, text))
            reports.append(report)
        except SourceError as error:
            errors.append(error.as_dict(name))
        except Exception:
            errors.append(SourceError('SOURCE_UNREADABLE').as_dict(name))
    if errors:
        return JSONResponse(status_code=422, content={'success': False, 'code': 'SOURCE_PREFLIGHT_FAILED', 'source_errors': errors})
    if context.get('scope_preflight'):
        # Ángela 18-11: a template header contradicting the selected practice
        # was discovered only after the paid extraction. Reading is free, so
        # the declared scope of every source is returned before any model call.
        from utils.source_scope import source_scope
        return JSONResponse(status_code=200, content={'success': True, 'scope_preflight': True, 'source_reports': [
            {'source': name, 'source_scope': source_scope(text), 'character_count': len(text)} for name, text in prepared]})

    results = []
    for (name, text), report in zip(prepared, reports):
        try:
            response = await _extract_readable_source(text, context)
            result = json.loads(response.body)
            if response.status_code != 200:
                return JSONResponse(status_code=response.status_code, content={**result, 'source_errors': [{'source': name, 'code': result.get('code', 'EXTRACTION_PROVIDER_ERROR')}]})
            from utils.source_scope import source_scope
            report['source_scope'] = source_scope(text)
            missing_scope = [field for field in ('directory', 'practice_area', 'jurisdiction') if field not in report['source_scope']]
            if missing_scope:
                report.setdefault('warnings', []).append('No se encontró una declaración explícita de ' + ', '.join(missing_scope) + '. Los filtros seleccionados fijan el objetivo; no son hechos confirmados por esta fuente.')
            report['filing_reconciliation'] = result.pop('filing_reconciliation', {'status': 'not_requested'})
            for key in ('source_reconciliation', 'administration_evidence', 'administration_issues'):
                if key in result: report[key] = result.pop(key)
            report['matter_count'] = len(result['matters'])
            report['empty_sections'] = result.pop('empty_sections', [])
            repeated=DocumentParser._count_matter_labels_in_text(text)['label_validation'].get('duplicate_labels',[])
            if repeated:report['numbering_reconciliation']={'repeated_headings':repeated,'method':'Distinct literal blocks retained with occurrence IDs; original headings preserved.'}
            report['layout'] = 'numbered_form' if DocumentParser.extract_numbered_matter_sections(text) else 'unstructured'
            if report['layout'] == 'unstructured' and not report.get('source_reconciliation'):
                report.setdefault('warnings', []).append('Fuente sin formulario numerado: confirma que el total y la identidad de los asuntos correspondan al documento; no hay un conteo independiente verificado.')
            if not result['matters']:
                report.setdefault('warnings', []).append('No se identificaron asuntos en esta fuente. Comprueba si solo aporta información complementaria.')
            for matter in result['matters']:
                matter['source_document'] = name
            result["source"] = name
            results.append(result)
        except SourceError as error:
            return JSONResponse(status_code=422, content={'success': False, 'code': 'SOURCE_PREFLIGHT_FAILED', 'source_errors': [error.as_dict(name)]})

    matters = [matter for result in results for matter in result['matters']]
    if not matters:
        return JSONResponse(status_code=422, content={'success': False, 'code': 'NO_LEGAL_MATTERS', 'source_reports': reports})
    for index, matter in enumerate(matters, 1):
        matter['id'] = f'matter-ext-{index}'
    # Retain all source findings rather than silently ignoring non-numbered sources.
    firm_names = {re.sub(r'\W+', '', result['metadata'].get('firm_name', '')).casefold() for result in results if result['metadata'].get('firm_name')}
    if len(firm_names) > 1:
        return JSONResponse(status_code=422, content={'success': False, 'code': 'SOURCE_PREFLIGHT_FAILED', 'source_errors': [SourceError('SOURCE_IDENTITY_CONFLICT').as_dict('Fuentes del submission')]})
    from utils.filing_extraction import resolve_filing_fields
    filing = resolve_filing_fields(results)
    merged = results[0]
    merged.update(filing)
    merged['metadata'] = {key: next((result['metadata'][key] for result in results if result['metadata'].get(key)), '') for key in merged['metadata']}
    for field in ('original_b10', 'original_c2'):
        merged[field] = '\n\n'.join(dict.fromkeys(result[field] for result in results if result[field]))
    merged['lawyers'] = list({json.dumps(lawyer, sort_keys=True): lawyer for result in results for lawyer in result['lawyers']}.values())
    if not merged['original_b10']:
        reports[0].setdefault('warnings', []).append('No se identificó una descripción literal del departamento (B10). Añádela desde tu fuente antes de optimizar.')
    merged['department'] = {'department_heads': list({head['name']: head for result in results for head in result['department']['department_heads']}.values())}
    merged.update(matters=matters, total_matters=len(matters), confidentiality_contract_version=1,
                  publishable_count=sum(m['publish_status'] == 'publishable' for m in matters),
                  confidential_count=sum(m['confidentialityStatus'] == 'confidential' for m in matters),
                  confirmation_required_count=sum(m['confidentialityStatus'] == 'confirmation_required' for m in matters),
                  source_reports=reports, ingestion_quality={'status': 'ready_for_review', 'sources_read': len(reports), 'matters_found': len(matters)})
    return JSONResponse(status_code=200, content=merged)


@api.post('/review-step')
async def review_step_endpoint(request: Request):
    """One role per call; the authenticated application persists each checkpoint."""
    from utils.provider_errors import provider_failure
    try:
        body = await request.json()
        payload = body.get('package')
        stage = body.get('stage')
        if not isinstance(payload, dict) or not isinstance(payload.get('matters'), list) or stage not in ('strategy', 'development', 'writer', 'editor'):
            return JSONResponse(status_code=400, content={'success': False, 'error': 'Invalid review step'})
        from core.review_graph import run_editorial_stage, release_gate
        from utils.ranking_verifier import verify_ranking_claim
        state = {**(body.get('state') or {}), 'package': payload,
                 'field_review_enabled': stage=='development'}
        state.pop('budget_stop',None)
        if stage in ('strategy','development'):
            payload['ranking_verification'] = await asyncio.to_thread(verify_ranking_claim, payload, state.get('ranking_verification'))
            state['ranking_verification'] = payload['ranking_verification']
        else:
            payload['ranking_verification'] = state.get('ranking_verification', {})
        state = await asyncio.to_thread(run_editorial_stage, stage, state)
        from utils.provider_budget import request_budget
        budget=request_budget.get()
        if budget and budget.last_stop:
            state['budget_stop']=budget.last_stop
            state['errors']=['La siguiente generación no se inició; se conserva el avance y el consumo anterior.']
            if stage=='development':state['development_validated']=False
        if state.get('repair_continuation'):
            next_stage = 'done'  # Saved below; the durable worker resumes the same role.
        elif state.get('errors'):
            next_stage = 'done'
            state.update(release_gate(state, require_judge=False))
        else:
            next_stage = {'strategy':'development','development':'writer','writer':'done','editor':'done'}[stage]
            if next_stage == 'done':
                state.update(release_gate(state, require_judge=stage == 'editor'))
        # Sources already live in the submission; do not duplicate them in checkpoints.
        state.pop('package', None)
        return JSONResponse(content={'success': True, 'next_stage': next_stage, 'state': state})
    except Exception as error:
        logger.exception('Editorial step failed')
        return JSONResponse(status_code=502, content={**provider_failure(error),'trace':getattr(error,'trace_history',getattr(error,'trace',None))})


@api.post('/review-package')
async def review_package_endpoint(request: Request):
    """Bounded strategy → letter → adversarial review; no database writes."""
    try:
        payload = await request.json()
        if not isinstance(payload, dict) or not isinstance(payload.get('matters'), list):
            return JSONResponse(status_code=400, content={'success':False,'error':'Invalid review package'})
        from utils.ranking_verifier import verify_ranking_claim
        payload['ranking_verification'] = await asyncio.to_thread(verify_ranking_claim, payload)
        from core.review_graph import review_graph, EDITORIAL_GRAPH_RECURSION_LIMIT
        result = await asyncio.to_thread(review_graph.invoke, {'package':payload}, {'recursion_limit':EDITORIAL_GRAPH_RECURSION_LIMIT})
        return JSONResponse(content={'success':True, 'ranking_verification':payload['ranking_verification'], **{key:result.get(key) for key in ('strategy','selection_validated','selection_review','selection_review_validated','development','development_validated','letter','judge','render_gate','release_verdict','trace')}})
    except Exception as error:
        logger.exception('Editorial package review failed')
        from utils.provider_errors import provider_failure
        return JSONResponse(status_code=502, content={**provider_failure(error),'trace':getattr(error,'trace_history',getattr(error,'trace',None))})


@api.post('/verify-rendered-package')
async def verify_rendered_package_endpoint(request: Request):
    """Final editorial gate sees the text extracted from the exact DOCX bytes."""
    try:
        payload = await request.json()
        if not isinstance(payload.get('package'), dict) or not payload['package'].get('rendered_artifact'):
            return JSONResponse(status_code=400, content={'success':False,'error':'Missing rendered artifact'})
        from core.review_graph import review_rendered_package
        result = await asyncio.to_thread(review_rendered_package, {'package':payload['package'],'strategy':payload.get('strategy',{}),'letter':payload.get('letter',{}),'trace':[],'output_recovery_attempt':1 if payload.get('output_recovery') is True else 0}, payload.get('allow_repair', True))
        from utils.provider_budget import request_budget, BudgetPreflightError
        budget=request_budget.get()
        if budget and budget.last_stop:
            from utils.provider_errors import provider_failure
            stopped=BudgetPreflightError(**budget.last_stop)
            return JSONResponse(status_code=502,content={**provider_failure(stopped),'trace':result.get('trace',[])})
        judge = dict(result.get('judge') or {})
        # A proposed/repaired letter is not proof that the exact rendered bytes
        # passed. Never discard scope-specific or acceptance findings here.
        defects = judge.get('defects') or []
        judge['passed'] = judge.get('passed') is True and not any(
            d.get('severity') == 'critical' for d in defects)
        result['judge'] = judge
        return JSONResponse(content={'success':True,**result})
    except Exception as error:
        logger.exception('Rendered artifact review failed')
        from utils.provider_errors import provider_failure
        return JSONResponse(status_code=502, content={**provider_failure(error),'trace':getattr(error,'trace_history',getattr(error,'trace',None))})


@api.post('/verify-ranking')
async def verify_ranking_endpoint(request: Request):
    from utils.ranking_verifier import verify_ranking_claim
    payload = await request.json()
    if not isinstance(payload, dict):
        return JSONResponse(status_code=400, content={'error':'Invalid ranking request'})
    result = await asyncio.to_thread(verify_ranking_claim, payload)
    return JSONResponse(content={'success':True, 'ranking_verification':result})
