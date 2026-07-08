from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from core.schema import SubmissionSchema
from agents.prompts import EXTRACTION_SYSTEM_PROMPT
from dotenv import load_dotenv

load_dotenv()


# System Prompt focused on 'Structural Signal Detection'

def get_extraction_chain(model_name="gpt-4o"):
    """
    Initializes and returns the extraction chain with structured output.
    """
    llm = ChatOpenAI(model=model_name, temperature=0)
    
    # This is where the magic happens: the LLM is forced to follow the schema
    structured_llm = llm.with_structured_output(SubmissionSchema)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", EXTRACTION_SYSTEM_PROMPT),
        ("human", "Analyze the following submission: {text}")
    ])
    
    return prompt | structured_llm