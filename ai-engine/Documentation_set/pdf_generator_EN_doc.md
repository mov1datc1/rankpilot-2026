## Overview: This module contains a utility function that compiles LaTeX source code into a PDF by saving it to a temporary file and invoking the pdflatex command-line tool twice to handle dependencies like table of contents or TikZ graphics.

## Classes: None

## Functions & Methods:

| Name | Parameters | Responsibility |
|------|------------|----------------|
| compile_latex_to_pdf | latex_code: str, output_filename: str | Accepts LaTeX code and an output filename base, writes the code to a .tex file, executes pdflatex twice in non-interactive mode, and returns the PDF filename on success or None on failure. |