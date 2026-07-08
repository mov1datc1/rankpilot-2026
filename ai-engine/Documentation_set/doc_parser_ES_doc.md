## Descripción general
Proporciona una clase de utilidad para analizar documentos PDF y DOCX en texto plano, garantizando una extracción de texto limpia adecuada para el procesamiento con LLM.

## Clases
- **DocumentParser**: Gestiona la ingesta de documentos en múltiples formatos enrutando hacia analizadores específicos del formato.

## Funciones y Métodos
| Nombre | Parámetros | Responsabilidad |
|------|------------|----------------|
| parse | file_path: str | Determina el formato del archivo y delega al analizador correspondiente (DOCX o PDF); lanza un error para formatos no compatibles. |
| _parse_docx | file_path: str | Extrae texto de archivos DOCX concatenando párrafos y filas de tablas no vacías (las celdas se separan con " | "). |
| _parse_pdf | file_path: str | Extrae texto de archivos PDF usando PyMuPDF, concatenando el texto de todas las páginas. |