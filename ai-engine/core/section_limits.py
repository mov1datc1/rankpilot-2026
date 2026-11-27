"""Word limits of the institutional and personal sections, in one place.

v1.0.124 (Jonathan, 27-11, after Ángela's Labour review): B10 follows the
Chambers form's own 500-word limit and is judged by its structure and quality;
B9 (per person) and C2 keep the 1,000-word project maximum.
"""
B10_MAX_WORDS = 500
C2_MAX_WORDS = 1000
B9_MAX_WORDS = 1000
# v1.0.127 (Ángela, Public Law): B9 is an individual argument, not a summary of the
# mandates that section D/E tells. It usually needs 200 to 400 words; below 200 a
# nominated profile is checked for an undeveloped argument, never padded to a target.
B9_ARGUMENT_WORDS = 200
B9_USUAL_WORDS = (200, 400)

# A generated B10 may condense a long original, never collapse it: the floor is
# 90 % of the original, but never more than 80 % of the maximum, so a 470-word
# original keeps room to be tightened while its distinctive elements survive.
B10_FLOOR_SHARE = 0.8

MAX_WORDS = {'b10': B10_MAX_WORDS, 'c2': C2_MAX_WORDS}


def words(text):
    return len(str(text or '').split())


def limits_sentence():
    return (f'B10 may run up to {B10_MAX_WORDS} words (the form\'s own limit); B9 (per person) and C2 may each '
            f'run up to {C2_MAX_WORDS:,} words')
