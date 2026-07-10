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
    cross_border_jurisdictions: Optional[str] = Field(default="", description="If cross-border, list the jurisdictions involved (e.g. 'USA, Mexico, Chile').")
    team_members: Optional[str] = Field(default="", description="Other team members who worked on this matter.")
    other_firms: Optional[str] = Field(default="", description="Other law firms advising on the matter and their roles.")
    matter_value: Optional[str] = Field(default="", description="The monetary value of the deal/matter with currency (e.g. 'USD 250 million').")
    completion_date: Optional[str] = Field(default="", description="Date of completion or current status of the matter.")
    is_confidential: bool = Field(default=False, description="True if this matter contains confidential information not for publication.")
    is_new_client: bool = Field(default=False, description="True if the client is new within the last 12 months.")

class LawyerProfile(BaseModel):
    """Profile of a ranked or unranked lawyer in the practice area."""
    name: str = Field(description="Full name of the lawyer.")
    url: Optional[str] = Field(default="", description="URL to the lawyer's biography page.")
    current_ranking: Optional[str] = Field(default="Not Ranked", description="Current Chambers ranking (e.g. 'Band 3', 'Not Ranked').")
    suggested_ranking: Optional[str] = Field(default="", description="Suggested ranking for this submission cycle.")
    key_focus: Optional[str] = Field(default="", description="Key areas of focus for this lawyer.")
    bio: Optional[str] = Field(default="", description="Brief biographical paragraph about the lawyer's practice.")
    standout_work: Optional[str] = Field(default="", description="Description of standout recent work. Prefix confidential parts with [CONFIDENTIAL].")
    is_partner: bool = Field(default=False, description="True if the lawyer is a partner.")
    is_ranked: bool = Field(default=False, description="True if the lawyer is currently ranked.")

class ContactPerson(BaseModel):
    """A contact person for interview arrangements."""
    name: str = Field(description="Full name of the contact.")
    email: Optional[str] = Field(default="", description="Email address.")
    phone: Optional[str] = Field(default="", description="Phone number with country code.")

class HireDeparture(BaseModel):
    """A hire or departure record for the department."""
    name: str = Field(description="Name of the person who joined or departed.")
    status: str = Field(default="", description="'Joined' or 'Departed'.")
    firm: Optional[str] = Field(default="", description="Name of the firm they joined from or departed to.")

class DepartmentInfo(BaseModel):
    """Department-level information for the submission."""
    department_name: Optional[str] = Field(default="", description="Department name as used by the firm.")
    num_partners: Optional[int] = Field(default=0, description="Number of partners in the department.")
    num_lawyers: Optional[int] = Field(default=0, description="Number of other qualified lawyers.")
    department_heads: List[ContactPerson] = Field(default_factory=list, description="Department heads or key partners.")
    hires_departures: List[HireDeparture] = Field(default_factory=list, description="Partner hires and departures in last 12 months.")
    department_description: Optional[str] = Field(default="", description="What the department is best known for (B7 section).")

class FirmMetadata(BaseModel):
    """Core details about the law firm and the submission."""
    firm_name: str = Field(description="The name of the law firm.")
    practice_area: str = Field(description="The practice area being submitted for (e.g. Banking & Finance).")
    location: str = Field(description="The jurisdiction or location of the firm.")
    narrative_overview: str = Field(description="A brief summary of the firm's narrative or intro.")

class SubmissionSchema(BaseModel):
    """The full structured representation of a law firm's practice submission."""
    metadata: FirmMetadata = Field(description="Core details about the law firm.")
    department: DepartmentInfo = Field(default_factory=DepartmentInfo, description="Department-level information.")
    lawyers: List[LawyerProfile] = Field(default_factory=list, description="Lawyer profiles for B6 section.")
    contacts: List[ContactPerson] = Field(default_factory=list, description="Contact persons for A4 section.")
    matters: List[Matter] = Field(description="List of distinct legal matters found in the text.")

class ContextEngineOutput(BaseModel):
    practice_type: str = Field(description="One of: transactional, disputes, regulatory, mixed.")
    archetype: str = Field(description="The strategic archetype of the firm (e.g. Lender-driven finance, Elite arbitration boutique).")
    complexity_profile: str = Field(description="Summary of complexity patterns (cross-border, multi-jurisdiction, etc.).")
    client_type: str = Field(description="Summary of institutional vs one-off client relationships.")
    identity_adn: str = Field(description="Capa 8 Synthesis combining archetype, complexity, client, and work type.")