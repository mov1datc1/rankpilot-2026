"""Preflight the serialized provider schema, including SDK-inlined enums."""
import copy
import re


def schema_metrics(schema):
    counts = {'enum_values': 0, 'object_properties': 0, 'name_enum_const_characters': 0}
    large_enums = []

    def visit(value):
        if isinstance(value, list):
            for child in value:
                visit(child)
        elif isinstance(value, dict):
            for key, child in value.items():
                if key == 'enum' and isinstance(child, list):
                    counts['enum_values'] += len(child)
                    chars = sum(len(str(item)) for item in child)
                    counts['name_enum_const_characters'] += chars
                    if len(child) > 250:
                        large_enums.append(chars)
                elif key in ('properties', '$defs') and isinstance(child, dict):
                    counts['name_enum_const_characters'] += sum(len(name) for name in child)
                    if key == 'properties':
                        counts['object_properties'] += len(child)
                elif key == 'const':
                    counts['name_enum_const_characters'] += len(str(child))
                if isinstance(child, (list, dict)):
                    visit(child)
    visit(schema)
    counts['large_enum_max_characters'] = max(large_enums, default=0)
    return counts


def validate_schema_limits(schema):
    counts = schema_metrics(schema)
    if counts['enum_values'] > 1000 or counts['object_properties'] > 5000 or counts['name_enum_const_characters'] > 120000 or counts['large_enum_max_characters'] > 15000:
        raise ValueError('Structured output schema exceeds provider limits')
    return counts


def bounded_reference_schema(schema):
    """Keep large own-passage choice sets without the provider enum ceiling.

    An anchored literal-alternative pattern permits precisely the same IDs.
    The original Pydantic Enum and own-source/output binding still validate
    returned values. Non-reference enums are never relaxed or truncated.
    """
    result = copy.deepcopy(schema)
    metrics=schema_metrics(result)
    if metrics['enum_values']>1000 or metrics['large_enum_max_characters']>15000 or metrics['name_enum_const_characters']>120000:
        def visit(value):
            if isinstance(value, dict):
                choices = value.get('enum')
                if value.get('type') == 'string' and isinstance(choices, list) and choices and all(
                    isinstance(choice, str) and re.fullmatch(r'[SP]_[0-9a-f]{16}', choice) for choice in choices):
                    value.pop('enum')
                    value['pattern'] = '^(?:' + '|'.join(re.escape(choice) for choice in choices) + ')$'
                for child in value.values():
                    visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)
        visit(result)
    validate_schema_limits(result)
    return result
