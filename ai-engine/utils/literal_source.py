"""A comparison view of rendered table borders, preserving source offsets."""
import re


def table_text_view(value):
    # Only line-edge borders introduced by table extraction. Interior pipes,
    # words, numbers, signs and headings remain significant.
    return re.sub(r'(?m)^([ \t]*)\||\|([ \t\r]*$)',
                  lambda match: match.group().replace('|', ' '), str(value or ''))
