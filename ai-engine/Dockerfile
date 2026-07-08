FROM python:3.10-slim

# Install system dependencies including pdflatex
RUN apt-get update && apt-get install -y \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-latex-extra \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Start the FastAPI server
CMD ["uvicorn", "main:api", "--host", "0.0.0.0", "--port", "10000"]
