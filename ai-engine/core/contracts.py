"""Canonical evidence contracts for the RankPilot pipeline.

These objects deliberately separate source facts, ranking strategy, generated
claims, and client-facing artifacts.  LLM output is never itself source
evidence.
"""

from enum import Enum
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FrozenContract(BaseModel):
    """Base class for immutable state passed between graph stages."""

    model_config = ConfigDict(extra="forbid", frozen=True)


class EvidenceSupport(str, Enum):
    EXPLICIT = "explicit"
    SEMANTIC = "semantic"
    UNSUPPORTED = "unsupported"


class GapSeverity(str, Enum):
    BLOCKING_FACTUAL = "blocking_factual"
    STRATEGIC = "strategic"
    OPTIONAL = "optional"
    RESOLVED = "resolved"


class SourceSpan(FrozenContract):
    span_id: str = Field(min_length=1)
    section: str = Field(min_length=1)
    text: str = Field(min_length=1)
    matter_id: Optional[str] = None
    confidentiality: Literal["publishable", "confidential", "internal"] = "internal"


class EvidenceClaim(FrozenContract):
    claim_id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    evidence_ids: List[str] = Field(default_factory=list)
    support: EvidenceSupport
    semantic_role: Optional[
        Literal["buyer", "seller", "target", "investor", "borrower", "lender", "counsel", "other"]
    ] = None

    @model_validator(mode="after")
    def supported_claims_require_evidence(self) -> "EvidenceClaim":
        if self.support != EvidenceSupport.UNSUPPORTED and not self.evidence_ids:
            raise ValueError("Supported claims require at least one evidence_id")
        if self.support == EvidenceSupport.UNSUPPORTED and self.evidence_ids:
            raise ValueError("Unsupported claims cannot cite evidence_ids")
        return self


class MatterRecord(FrozenContract):
    matter_id: str = Field(min_length=1)
    source_label: str = Field(min_length=1)
    publish_status: Literal["publishable", "confidential"]
    client: str = Field(min_length=1)
    title: str = ""
    source_span_ids: List[str] = Field(default_factory=list)
    lead_lawyers: List[str] = Field(default_factory=list)
    client_role: Optional[
        Literal["buyer", "seller", "target", "investor", "borrower", "lender", "other"]
    ] = None
    counterparty: Optional[str] = None
    matter_value: Optional[str] = None
    value_type: Optional[Literal["matter", "transaction", "project", "asset", "exposure", "unknown"]] = None
    completion_status: Optional[str] = None


class LawyerRecord(FrozenContract):
    lawyer_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    is_partner: Optional[bool] = None
    is_ranked: Optional[bool] = None
    current_ranking: Optional[str] = None
    source_span_ids: List[str] = Field(default_factory=list)


class DocumentManifest(FrozenContract):
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    source_format: Literal["doc", "docx", "pdf"]
    total_matters: int = Field(ge=0)
    publishable_matters: int = Field(ge=0)
    confidential_matters: int = Field(ge=0)
    matter_labels: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def totals_must_reconcile(self) -> "DocumentManifest":
        if self.publishable_matters + self.confidential_matters != self.total_matters:
            raise ValueError("Publishable and confidential counts must equal total_matters")
        if self.matter_labels and len(self.matter_labels) != self.total_matters:
            raise ValueError("matter_labels must contain exactly total_matters entries")
        return self


class StrategicObjective(FrozenContract):
    directory: str = Field(min_length=1)
    practice_area: str = Field(min_length=1)
    ranking_unit: str = Field(min_length=1)
    current_position: str = Field(min_length=1)
    target: str = Field(min_length=1)
    priority: str = Field(min_length=1)


class GapRecord(FrozenContract):
    gap_id: str = Field(min_length=1)
    severity: GapSeverity
    subject_id: str = Field(min_length=1)
    description: str = Field(min_length=1)
    question: Optional[str] = None

    @model_validator(mode="after")
    def unresolved_material_gaps_require_questions(self) -> "GapRecord":
        if self.severity in {GapSeverity.BLOCKING_FACTUAL, GapSeverity.STRATEGIC} and not self.question:
            raise ValueError("Blocking and strategic gaps require a targeted question")
        return self


class CanonicalSubmission(FrozenContract):
    manifest: DocumentManifest
    objective: StrategicObjective
    source_spans: List[SourceSpan]
    matters: List[MatterRecord]
    lawyers: List[LawyerRecord] = Field(default_factory=list)
    source_claims: List[EvidenceClaim] = Field(default_factory=list)
    gaps: List[GapRecord] = Field(default_factory=list)


class GeneratedArtifact(FrozenContract):
    artifact_type: Literal["optimized_submission", "strategic_audit"]
    text: str
    claims: List[EvidenceClaim] = Field(default_factory=list)
    metadata: Dict[str, str] = Field(default_factory=dict)


class ReconciliationResult(FrozenContract):
    passed: bool
    errors: List[str] = Field(default_factory=list)
    source_total: int
    extracted_total: int
    missing_count: int = 0
    over_extracted_count: int = 0
