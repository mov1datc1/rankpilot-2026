## Información general
Proporciona una función de fábrica para construir una cadena de extracción que utiliza un modelo de lenguaje de salida estructurada para analizar envíos de texto y producir una respuesta que se ajusta a un esquema predefinido.

## Clases
Ninguna

## Funciones y Métodos
| Nombre | Parámetros | Responsabilidad |
|------|------------|----------------|
| get_extraction_chain | model_name: str = "gpt-4o" | Inicializa una instancia de `ChatOpenAI` con el modelo especificado y temperatura 0, la configura para salida estructurada usando `SubmissionSchema`, la combina con una plantilla de prompt que contiene `EXTRACTION_SYSTEM_PROMPT` y una entrada de texto dinámica, y devuelve la cadena ejecutable resultante. |