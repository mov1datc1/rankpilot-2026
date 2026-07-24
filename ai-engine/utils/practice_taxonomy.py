"""
v10.0 — Practice-Specific Taxonomy
Provides practice-area-specific evaluation criteria.
Ensures Labour & Employment is NOT evaluated with Corporate/M&A criteria.
"""

PRACTICE_TAXONOMY = {
    "labour": {
        "name": "Labour & Employment",
        "keywords": ["labour", "labor", "employment", "workplace", "workforce"],
        "value_dimensions": [
            "workforce_scale",           # number of employees affected
            "litigation_count",          # number of active/resolved disputes
            "jurisdiction_count",        # number of states/regions/plants
            "collective_bargaining",     # union complexity, CBA negotiations
            "strike_prevention",         # operational disruption risk prevented
            "regulatory_novelty",        # reform-driven complexity (labour reform, Ley Silla, etc.)
            "precedent_value",           # constitutional challenges, amparo, novel rulings
            "measurable_outcome",        # savings %, settlement efficiency, 0-contingency transitions
            "operational_continuity",    # business continuity impact, zero-downtime transitions
            "plant_count",              # multi-plant integration complexity
            "geographic_dispersion",     # national vs regional scope
            "employee_transition",       # mass layoffs, demobilisation, M&A workforce integration
        ],
        "value_is_not": "deal_value",
        "value_explanation": (
            "In Labour & Employment, matter value is NOT determined by deal size or transaction value. "
            "A matter involving 50 litigations across 4 states with 5,000 employees may be MORE significant "
            "than a USD 100M transaction. Value comes from workforce scale, litigation complexity, "
            "strike prevention, operational continuity, and measurable risk reduction."
        ),
        "redundancy_test": (
            "Two Labour matters are NOT redundant if they involve:\n"
            "- Different industrial sectors\n"
            "- Different types of labour risk (litigation vs prevention vs collective bargaining)\n"
            "- Different workforce scales\n"
            "- Different geographic scopes\n"
            "- Different regulatory dimensions\n"
            "Two matters are NOT redundant simply because both contain labour litigation."
        ),
        "matter_label": "Labour mandate",
        "quality_dimensions": [
            "Workforce scale (employees impacted)",
            "Number of jurisdictions/plants involved",
            "Collective bargaining complexity",
            "Union sensitivity and strike risk",
            "Litigation exposure (number + monetary)",
            "Operational disruption risk prevented",
            "Regulatory novelty (reform-driven)",
            "Precedent value (constitutional/amparo)",
            "Measurable outcome (savings, settlement ratio)",
            "Senior lawyer involvement",
            "Client significance and relationship depth",
            "Continuity of mandate (multi-year)",
        ]
    },
    "corporate_ma": {
        "name": "Corporate / M&A",
        "keywords": ["corporate", "m&a", "merger", "acquisition", "transact"],
        "value_dimensions": [
            "deal_value",
            "transaction_complexity",
            "cross_border_jurisdictions",
            "regulatory_approvals",
            "parties_count",
            "structuring_innovation",
            "market_significance",
            "repeat_client_relationship",
        ],
        "value_is_not": None,
        "value_explanation": "In Corporate/M&A, deal value is a primary indicator alongside transaction complexity and cross-border scope.",
        "redundancy_test": "Two corporate matters are NOT redundant if they involve different transaction types, different sectors, or materially different deal structures.",
        "matter_label": "Transaction",
        "quality_dimensions": [
            "Deal value",
            "Transaction complexity",
            "Cross-border scope",
            "Role (lead counsel vs local counsel)",
            "Client significance",
            "Market impact / precedent",
            "Regulatory dimension",
            "Structuring innovation",
        ]
    },
    "banking_finance": {
        "name": "Banking & Finance",
        "keywords": ["banking", "finance", "lending", "debt", "restructuring", "capital markets"],
        "value_dimensions": [
            "deal_value",
            "facility_complexity",
            "cross_border_jurisdictions",
            "number_of_lenders",
            "structuring_innovation",
            "distressed_complexity",
            "regulatory_dimension",
            "market_significance",
        ],
        "value_is_not": None,
        "value_explanation": "In Banking & Finance, deal value and facility complexity are primary indicators.",
        "redundancy_test": "Two banking matters are NOT redundant if they involve different facility types, different credit risk profiles, or materially different structures.",
        "matter_label": "Transaction",
        "quality_dimensions": [
            "Deal/facility value",
            "Number of lenders/parties",
            "Structuring complexity",
            "Cross-border dimensions",
            "Distressed/workout component",
            "Regulatory novelty",
            "Client significance",
            "Role (lender-side vs borrower-side)",
        ]
    },
    "dispute_resolution": {
        "name": "Dispute Resolution",
        "keywords": ["dispute", "litigation", "arbitration", "contentious"],
        "value_dimensions": [
            "claim_value",
            "procedural_complexity",
            "precedent_value",
            "jurisdictions_involved",
            "parties_count",
            "outcome_significance",
            "constitutional_dimension",
            "duration_and_persistence",
        ],
        "value_is_not": None,
        "value_explanation": "In disputes, claim value and outcome significance are key, alongside procedural complexity and precedent impact.",
        "redundancy_test": "Two dispute matters are NOT redundant if they involve different legal theories, different industries, or different procedural mechanisms.",
        "matter_label": "Dispute",
        "quality_dimensions": [
            "Claim value",
            "Procedural complexity",
            "Precedent/constitutional impact",
            "Number of parties",
            "Cross-border dimension",
            "Duration and persistence",
            "Outcome significance",
            "Client significance",
        ]
    }
}


def get_practice_taxonomy(practice_area: str) -> dict:
    """Resolve a practice area name to its taxonomy configuration."""
    if not practice_area:
        return {}
    
    pa = str(practice_area).lower().strip()
    
    for key, config in PRACTICE_TAXONOMY.items():
        for keyword in config["keywords"]:
            if keyword in pa:
                return config
    
    return {}  # No specific taxonomy found — use generic


def get_practice_context_block(practice_area: str) -> str:
    """Generate the PRACTICE_SPECIFIC_CONTEXT block to inject into prompts."""
    taxonomy = get_practice_taxonomy(practice_area)
    
    if not taxonomy:
        return ""  # No specific block needed for unrecognized practice areas
    
    dimensions_list = "\n".join(f"  - {d}" for d in taxonomy["quality_dimensions"])
    
    block = f"""
### PRACTICE-SPECIFIC EVALUATION CRITERIA (v10.0 — {taxonomy['name'].upper()}):

{taxonomy['value_explanation']}

Value dimensions for {taxonomy['name']}:
{dimensions_list}

REDUNDANCY TEST for {taxonomy['name']}:
{taxonomy['redundancy_test']}

Matter terminology: Use "{taxonomy['matter_label']}" where appropriate.
"""
    
    if taxonomy.get("value_is_not"):
        block += f"""
⚠️ DO NOT apply {taxonomy['value_is_not']} as the primary value metric for {taxonomy['name']} matters.
"""
    
    return block
