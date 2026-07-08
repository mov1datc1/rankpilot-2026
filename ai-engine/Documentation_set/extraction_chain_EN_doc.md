## Overview
Provides a factory function to construct an extraction chain that utilizes a structured-output language model to analyze text submissions and produce a response conforming to a predefined schema.

## Classes
None

## Functions & Methods
| Name | Parameters | Responsibility |
|------|------------|----------------|
| get_extraction_chain | model_name: str = "gpt-4o" | Initializes a `ChatOpenAI` instance with the specified model and temperature 0, configures it for structured output using `SubmissionSchema`, combines it with a prompt template containing `EXTRACTION_SYSTEM_PROMPT` and a dynamic text input, and returns the resulting runnable chain. |