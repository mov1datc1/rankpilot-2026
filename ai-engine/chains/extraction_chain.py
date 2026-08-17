from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from core.schema import SubmissionSchema
from agents.prompts import EXTRACTION_SYSTEM_PROMPT
from dotenv import load_dotenv

load_dotenv()


# System Prompt focused on 'Structural Signal Detection'

import os

def get_extraction_chain(model_name=None):
    """
    Initializes and returns the extraction chain with structured output.
    Uses OPENAI_MODEL env var (defaults to gpt-5.6-terra) and OPENAI_API_KEY.
    """
    if model_name is None:
        model_name = os.environ.get("OPENAI_MODEL", "gpt-5.6-terra")
    
    api_key = os.environ.get("OPENAI_API_KEY")
    llm = ChatOpenAI(model=model_name, temperature=0, openai_api_key=api_key)
    
    # This is where the magic happens: the LLM is forced to follow the schema
    structured_llm = llm.with_structured_output(SubmissionSchema)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", EXTRACTION_SYSTEM_PROMPT),
        ("human", "Analyze the following submission: {text}")
    ])
    
    return prompt | structured_llm