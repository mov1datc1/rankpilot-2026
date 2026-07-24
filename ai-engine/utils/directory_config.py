"""
v10.0 — Directory Configuration Layer
Provides directory-specific terminology, structure, and evaluation criteria.
Ensures Legal 500 never loads Chambers logic, and vice versa.
"""

DIRECTORY_CONFIG = {
    "chambers": {
        "name": "Chambers & Partners",
        "short_name": "Chambers",
        "ranking_unit": "Band",
        "ranking_labels": ["Band 1", "Band 2", "Band 3", "Band 4", "Band 5", "Band 6", "Unranked"],
        "wrong_unit": "Tier",  # What NOT to use
        "matter_label": "matter",
        "quality_labels": {
            "flagship": "Flagship matter",
            "strong": "Strong matter for this directory",
            "underdeveloped": "Good but underdeveloped matter",
            "low_value": "Low-value or wrong-fit matter"
        },
        "lawyer_categories": [
            "Star Individual", "Band 1", "Band 2", "Band 3", "Band 4",
            "Up and Coming", "Associates to Watch"
        ],
        "structure_sections": [
            "A. Preliminary Information",
            "B. Department Information",
            "C. Market Feedback",
            "D. Publishable Information",
            "E. Confidential Information"
        ],
        "export_template": "chambers",
        "evaluation_phrasing": {
            "firm_assessment": "Based on the evidence currently presented, the submission appears more closely aligned with the characteristics typically observed at {ranking_unit} {level} than with those associated with {ranking_unit} {target}.",
            "benchmark_ref": "Firms at {ranking_unit} {level} for {practice} in {jurisdiction} typically demonstrate {criteria}."
        }
    },
    "legal500": {
        "name": "The Legal 500",
        "short_name": "Legal 500",
        "ranking_unit": "Tier",
        "ranking_labels": ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5", "Recommended", "Unranked"],
        "wrong_unit": "Band",  # What NOT to use
        "matter_label": "work highlight",
        "quality_labels": {
            "flagship": "Flagship work highlight",
            "strong": "Strong work highlight",
            "underdeveloped": "Good but underdeveloped highlight",
            "low_value": "Low-relevance highlight"
        },
        "lawyer_categories": [
            "Hall of Fame", "Leading Partner", "Next Generation Partner",
            "Leading Associate", "Rising Star"
        ],
        "structure_sections": [
            "Practice overview",
            "What sets your practice apart",
            "Initiatives and innovation",
            "Leading Partners",
            "Next Generation Partners",
            "Leading Associates",
            "Publishable matter summaries",
            "Detailed work highlights",
            "Referee spreadsheet"
        ],
        "export_template": "legal500",
        "evaluation_phrasing": {
            "firm_assessment": "Based on the evidence currently presented, the submission appears more closely aligned with the characteristics typically observed at {ranking_unit} {level} than with those associated with {ranking_unit} {target}.",
            "benchmark_ref": "Firms at {ranking_unit} {level} for {practice} in {jurisdiction} typically demonstrate {criteria}."
        }
    },
    "iflr1000": {
        "name": "IFLR1000",
        "short_name": "IFLR1000",
        "ranking_unit": "Tier",
        "ranking_labels": ["Tier 1", "Tier 2", "Tier 3", "Notable Firm", "Unranked"],
        "wrong_unit": "Band",
        "matter_label": "deal",
        "quality_labels": {
            "flagship": "Flagship deal",
            "strong": "Strong deal for this directory",
            "underdeveloped": "Good but underdeveloped deal",
            "low_value": "Low-relevance deal"
        },
        "lawyer_categories": [
            "Highly Regarded", "Rising Star", "Notable Practitioner"
        ],
        "structure_sections": [
            "Firm overview",
            "Notable deals",
            "Key lawyers"
        ],
        "export_template": "iflr1000",
        "evaluation_phrasing": {
            "firm_assessment": "Based on the evidence currently presented, the submission appears more closely aligned with the characteristics typically observed at {ranking_unit} {level} than with those associated with {ranking_unit} {target}.",
            "benchmark_ref": "Firms at {ranking_unit} {level} for {practice} in {jurisdiction} typically demonstrate {criteria}."
        }
    },
    "leaders_league": {
        "name": "Leaders League",
        "short_name": "Leaders League",
        "ranking_unit": "Category",
        "ranking_labels": ["Leading", "Excellent", "Highly Recommended", "Recommended", "Unranked"],
        "wrong_unit": "Band",
        "matter_label": "engagement",
        "quality_labels": {
            "flagship": "Flagship engagement",
            "strong": "Strong engagement",
            "underdeveloped": "Good but underdeveloped engagement",
            "low_value": "Low-relevance engagement"
        },
        "lawyer_categories": ["Leading", "Excellent", "Highly Recommended", "Recommended"],
        "structure_sections": ["Overview", "Key deals", "Key lawyers"],
        "export_template": "leaders_league",
        "evaluation_phrasing": {
            "firm_assessment": "Based on the evidence currently presented, the submission appears more closely aligned with the characteristics typically associated with '{level}' than with '{target}'.",
            "benchmark_ref": "Firms categorised as '{level}' for {practice} in {jurisdiction} typically demonstrate {criteria}."
        }
    }
}


def get_directory_config(directory: str) -> dict:
    """Resolve a directory name to its configuration.
    Handles variations like 'Legal 500', 'legal500', 'The Legal 500', 'Chambers', etc.
    """
    if not directory:
        return DIRECTORY_CONFIG["chambers"]  # Default fallback
    
    d = str(directory).lower().strip()
    
    if "500" in d or "legal5" in d:
        return DIRECTORY_CONFIG["legal500"]
    elif "iflr" in d:
        return DIRECTORY_CONFIG["iflr1000"]
    elif "leader" in d:
        return DIRECTORY_CONFIG["leaders_league"]
    else:
        # Default to Chambers (includes 'chambers', 'Chambers & Partners', etc.)
        return DIRECTORY_CONFIG["chambers"]


def get_directory_context_block(directory: str, practice_area: str = "", jurisdiction: str = "") -> str:
    """Generate the DIRECTORY_CONTEXT_BLOCK to inject into prompts.
    This ensures all prompts use correct directory-specific terminology.
    """
    config = get_directory_config(directory)
    
    return f"""
### DIRECTORY CONTEXT (v10.0 — INJECTED AUTOMATICALLY / DO NOT OVERRIDE):
Directory: {config['name']}
Ranking unit: {config['ranking_unit']} (use ONLY this term — NEVER use "{config['wrong_unit']}")
Ranking levels: {', '.join(config['ranking_labels'])}
Matter terminology: Use "{config['matter_label']}" (NOT "matter" if directory is not Chambers)
Lawyer categories for this directory: {', '.join(config['lawyer_categories'])}
Quality labels: {' | '.join(f'"{v}"' for v in config['quality_labels'].values())}

CRITICAL TERMINOLOGY RULES:
- NEVER say "Band" when directory is {config['name']} and ranking_unit is "{config['ranking_unit']}"
- NEVER say "Strong Chambers matter" — say "Strong {config['matter_label']}"  
- NEVER say "Chambers-grade" — say "{config['short_name']}-grade"
- NEVER reference Chambers URL, template, or structure if directory is not Chambers
- The firm IS NOT a "{config['ranking_unit']} X firm" — the SUBMISSION may align with {config['ranking_unit']} X characteristics
"""
