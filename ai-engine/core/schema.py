from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class Matter(BaseModel):
    """Represents a specific legal case or 'matter' from the submission."""
    title: str = Field(description="The formal name of the legal matter or case.")
    client: str = Field(description="The name of the client involved.")
    summary: str = Field(description="A brief description of the work performed.")
    significance: str = Field(description="Why this matter is strategically important.")
    lead_partner: str = Field(description="The primary partner in charge of this matter.")
    is_cross_border: bool = Field(description="True if the matter involves multiple jurisdictions.")

class FirmMetadata(BaseModel):
    """Core details about the law firm and the submission."""
    firm_name: str = Field(description="The name of the law firm.")
    practice_area: str = Field(description="The practice area being submitted for (e.g. Banking & Finance).")
    location: str = Field(description="The jurisdiction or location of the firm.")
    narrative_overview: str = Field(description="A brief summary of the firm's narrative or intro.")

class SubmissionSchema(BaseModel):
    """The full structured representation of a law firm's practice submission."""
    metadata: FirmMetadata = Field(description="Core details about the law firm.")
    matters: List[Matter] = Field(description="List of distinct legal matters found in the text.")

class ContextEngineOutput(BaseModel):
    practice_type: str = Field(description="One of: transactional, disputes, regulatory, mixed.")
    archetype: str = Field(description="The strategic archetype of the firm (e.g. Lender-driven finance, Elite arbitration boutique).")
    complexity_profile: str = Field(description="Summary of complexity patterns (cross-border, multi-jurisdiction, etc.).")
    client_type: str = Field(description="Summary of institutional vs one-off client relationships.")
    identity_adn: str = Field(description="Capa 8 Synthesis combining archetype, complexity, client, and work type.")