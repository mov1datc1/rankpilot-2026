from pydantic import BaseModel, Field
from typing import List, Optional

class Matter(BaseModel):
    """Represents a specific legal case or 'matter' from the submission."""
    title: str = Field(description="The formal name of the legal matter or case.")
    client: str = Field(description="The name of the client involved.")
    summary: str = Field(description="A brief description of the work performed.")
    significance: str = Field(description="Why this matter is strategically important.")
    lead_partner: str = Field(description="The primary partner in charge of this matter.")
    is_cross_border: bool = Field(description="True if the matter involves multiple jurisdictions.")

class SubmissionSchema(BaseModel):
    """The full structured representation of a law firm's practice submission."""
    firm_id: str = Field(description="The unique identifier from the database/conversation.")
    firm_name: str = Field(description="The formal name of the law firm.")
    practice_area: str = Field(description="The specific legal department or practice area.")
    location: str
    narrative_overview: str
    matters: List[Matter]