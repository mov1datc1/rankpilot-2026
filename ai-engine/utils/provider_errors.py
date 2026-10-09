"""Stable product errors without exposing provider bodies, keys or source data."""

def provider_failure(error):
    text = str(error).lower()
    if 'review diagnostic not grounded' in text:
        return {'success':False,'code':'AI_REVIEW_INVALID','error':'RankPilot está comprobando una observación interna antes de continuar. El avance se conserva.'}
    if any(term in text for term in ('insufficient_quota', 'credit_balance_exhausted', 'no credits remaining', 'billing_hard_limit')):
        return {'success': False, 'code': 'AI_CREDIT_EXHAUSTED', 'error': 'El proveedor de IA no tiene crédito disponible. El administrador debe revisar la facturación. Se conserva el avance guardado.'}
    if any(term in text for term in ('max_output_tokens', 'lengthfinishreason', 'length limit', 'structured response unavailable', 'eof while parsing')):
        return {'success': False, 'code': 'AI_OUTPUT_LIMIT', 'error': 'La respuesta de IA no quedó completa dentro del límite de tokens. Se conserva el avance para recuperar únicamente esta etapa.'}
    return {'success': False, 'code': 'AI_REVIEW_UNAVAILABLE', 'error': 'No se completó esta etapa de IA. El avance anterior se conserva y no se considera aprobado.'}
