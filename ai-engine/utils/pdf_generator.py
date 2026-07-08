import subprocess
import os

def compile_latex_to_pdf(latex_code: str, output_filename: str):
    """
    Compiles LaTeX code into a PDF using pdflatex.
    """
    tex_file = f"{output_filename}.tex"
    
    # 1. Save the LaTeX code to a temporary .tex file
    with open(tex_file, "w", encoding="utf-8") as f:
        f.write(latex_code)
    
    # 2. Run pdflatex (usually needs to run twice for TOC and TikZ)
    try:
        for _ in range(2):
            subprocess.run(
                ["pdflatex", "-interaction=nonstopmode", tex_file],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
        return f"{output_filename}.pdf"
    except subprocess.CalledProcessError as e:
        print(f"LaTeX Error: {e}")
        return None