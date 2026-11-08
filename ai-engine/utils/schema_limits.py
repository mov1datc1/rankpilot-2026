"""Preflight the serialized provider schema, including SDK-inlined enums."""


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
