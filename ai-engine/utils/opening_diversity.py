"""
v20.0: Opening Diversity Tracker — deterministic enforcement of varied matter openings.
Source: ChatGPT 5.6 Sol consultation, adapted for RankPilot LangGraph pipeline.

The LLM tends to start 3+ matters with "The..." or "This..." despite prompt instructions.
This module provides DETERMINISTIC external state tracking:
  1. Tracks used first words across sequential matter generations
  2. Generates dynamic prohibition instructions for the prompt
  3. Validates output BEFORE accepting it
  4. Provides suggested alternative openings for legal matters
"""

import re
from typing import Set, List, Optional


# ============================================================
# SUGGESTED OPENINGS FOR LEGAL MATTER DESCRIPTIONS
# ============================================================

SUGGESTED_OPENINGS = [
    "Acting",
    "Advising",
    "Representing",
    "Assisting",
    "Guiding",
    "Supporting",
    "Counseling",
    "Handling",
    "Managing",
    "Leading",
    "Coordinating",
    "Defending",
    "Negotiating",
    "Developing",
    "Structuring",
    "Design",
    "Implementation",
    "Regularisation",
    "Establishment",
    "Creation",
    "A",
    "An",
    "In",
    "Across",
    "Following",
    "During",
    "Over",
    "Throughout",
]


# ============================================================
# TRACKER CLASS
# ============================================================

class OpeningDiversityTracker:
    """
    Tracks opening words across sequential matter generations.
    
    Usage in LangGraph pipeline:
        tracker = OpeningDiversityTracker()
        
        for matter in matters:
            # Inject into prompt
            diversity_instruction = tracker.prompt_instruction()
            
            # ... LLM generates ...
            
            # Validate
            if tracker.validate(response_text):
                tracker.register(response_text)
            else:
                # Retry with stronger prohibition
                ...
    """

    def __init__(
        self,
        banned_defaults: Optional[Set[str]] = None,
        max_repeats: int = 1,
    ):
        """
        Args:
            banned_defaults: Words that should never be used as openers.
            max_repeats: How many times a word can be reused (default=1 means unique).
        """
        self.used_first_words: Set[str] = set()
        self.max_repeats = max_repeats

        self.banned_defaults = {
            word.lower()
            for word in (
                banned_defaults
                or {
                    "the",
                    "this",
                    "our",
                    "it",
                    "we",
                }
            )
        }

    @staticmethod
    def first_word(text: str) -> Optional[str]:
        """
        Return first lexical word, ignoring quotes / markdown / whitespace.
        """
        cleaned = re.sub(
            r'^[\s\'"""''*#>\-–—•·]+',
            '',
            text.strip()
        )
        match = re.search(
            r"[A-Za-zÀ-ÖØ-öø-ÿ]+",
            cleaned
        )
        return match.group(0).lower() if match else None

    def register(self, text: str) -> Optional[str]:
        """
        Register a text's first word as used.
        Returns the word that was registered.
        """
        word = self.first_word(text)
        if word:
            self.used_first_words.add(word)
        return word

    def forbidden_words(self) -> Set[str]:
        """All words that cannot be used as openers."""
        return self.used_first_words | self.banned_defaults

    def prompt_instruction(self) -> str:
        """
        Generate a dynamic prohibition string for the LLM prompt.
        
        This is injected into each matter's enhancement prompt and grows
        with each generation — guaranteeing diversity.
        """
        forbidden = sorted(self.forbidden_words())

        if not forbidden:
            return ""

        formatted = ", ".join(f'"{word}"' for word in forbidden)

        return (
            "\n"
            "═══ OPENING-WORD CONSTRAINT — MANDATORY ═══\n"
            "\n"
            f"The first lexical word of this response MUST NOT be any of:\n"
            f"{formatted}\n"
            "\n"
            "Choose a DIFFERENT opening word.\n"
            "\n"
            "This constraint applies to the literal FIRST WORD of the response,\n"
            "not merely the first sentence.\n"
            "\n"
            "Before returning the final response, internally verify that its first\n"
            "word does not appear in the prohibited list.\n"
            "═══════════════════════════════════════════\n"
        )

    def prompt_with_suggestions(self) -> str:
        """
        Generate prohibition + suggested alternatives.
        More effective than prohibition alone.
        """
        base = self.prompt_instruction()
        available = available_openings(self)

        if available:
            suggestions = ", ".join(f'"{w}"' for w in available[:8])
            base += (
                f"\nPossible unused opening words include: {suggestions}\n"
                "You are not required to use one of them, but your first word\n"
                "MUST be different from all previously used openings.\n"
            )

        return base

    def validate(self, text: str) -> bool:
        """
        Check if text's first word is allowed (not in forbidden set).
        
        IMPORTANT: Call validate() BEFORE register().
        """
        word = self.first_word(text)
        if not word:
            return False
        return word not in self.forbidden_words()

    def get_stats(self) -> dict:
        """Return current tracking state for debugging."""
        return {
            "used_words": sorted(self.used_first_words),
            "banned_defaults": sorted(self.banned_defaults),
            "forbidden_count": len(self.forbidden_words()),
            "matters_tracked": len(self.used_first_words),
        }


def available_openings(
    tracker: OpeningDiversityTracker,
) -> List[str]:
    """
    Return suggested openings that haven't been used yet.
    """
    forbidden = tracker.forbidden_words()
    return [
        word
        for word in SUGGESTED_OPENINGS
        if word.lower() not in forbidden
    ]


def force_opening_diversity(
    text: str,
    tracker: OpeningDiversityTracker,
) -> str:
    """
    Programmatic fallback: if the LLM repeatedly uses a forbidden word
    after all retries, this function replaces the first word with an
    available alternative.
    
    This is a LAST RESORT — the result may be grammatically imperfect,
    but it guarantees diversity.
    """
    word = tracker.first_word(text)
    if not word or tracker.validate(text):
        return text  # Already valid

    alternatives = available_openings(tracker)
    if not alternatives:
        return text  # All openings exhausted

    replacement = alternatives[0]

    # Find and replace the first word
    cleaned = text.lstrip()
    match = re.search(r"[A-Za-zÀ-ÖØ-öø-ÿ]+", cleaned)
    if match:
        start = match.start()
        end = match.end()
        # Reconstruct with proper capitalization
        result = cleaned[:start] + replacement + cleaned[end:]
        print(f"  [DIVERSITY FORCE v20.0] Replaced opening '{match.group()}' → '{replacement}'")
        return result

    return text


# ============================================================
# EXAMPLE
# ============================================================

if __name__ == "__main__":
    tracker = OpeningDiversityTracker()

    sample_matters = [
        "The team advised Grupo Hermes on regulatory compliance.",
        "This engagement involved a complex data protection framework.",
        "The firm represented Biocodex in INAI proceedings.",
        "Advising MEGA DIRECT on a comprehensive privacy program.",
        "Representing Tiendas Chedraui across 200 retail locations.",
        "The team designed a data governance framework.",
        "This matter established precedent for cross-sector advice.",
    ]

    print("=== Opening Diversity Tracker Demo ===\n")
    for i, matter in enumerate(sample_matters, 1):
        word = tracker.first_word(matter)
        valid = tracker.validate(matter)
        
        if valid:
            tracker.register(matter)
            print(f"Matter {i}: '{word}' ✅")
        else:
            forced = force_opening_diversity(matter, tracker)
            new_word = tracker.first_word(forced)
            tracker.register(forced)
            print(f"Matter {i}: '{word}' ❌ → forced to '{new_word}' ✅")

    print(f"\nStats: {tracker.get_stats()}")
