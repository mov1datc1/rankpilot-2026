## Descripción general: Este módulo contiene una función de utilidad que compila código fuente LaTeX en un PDF guardándolo en un archivo temporal e invocando la herramienta de línea de comandos pdflatex dos veces para manejar dependencias como el índice de contenido o gráficos TikZ.

## Clases: Ninguno

## Funciones y Métodos:

| Nombre | Parámetros | Responsabilidad |
|-------|------------|----------------|
| compile_latex_to_pdf | latex_code: str, output_filename: str | Acepta código LaTeX y un nombre base de archivo de salida, escribe el código en un archivo .tex, ejecuta pdflatex dos veces en modo no interactivo y devuelve el nombre del archivo PDF en caso de éxito o None en caso de fallo. |