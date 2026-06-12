import os
import pandas as pd
import json
from langchain.tools import tool
from langchain_experimental.agents import create_pandas_dataframe_agent
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
CSV_PATH = os.path.join(DATA_DIR, "market_data.csv")
JSON_PATH = os.path.join(DATA_DIR, "narratives.json")

# Initialize LLM for the Pandas Agent
# Note: GROQ_API_KEY should be in environment variables
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.1
)

@tool
def financial_comparator_tool(query: str) -> str:
    """
    Useful for comparing financial metrics between companies (tickers), listing available companies, 
    or querying the dataset using market_data.csv.
    Can handle queries like 'Compare AAPL and AMD' or 'What companies are in the data?'.
    """
    df = pd.read_csv(CSV_PATH)
    
    agent = create_pandas_dataframe_agent(
        llm,
        df,
        verbose=True,
        allow_dangerous_code=True,
        prefix="""
        You are a financial analyst. 
        When asked to compare tickers (e.g., 'Compare AAPL and AMD'), 
        you MUST fetch the relevant rows for ALL mentioned tickers from the dataframe.
        If asked to list companies, YOU MUST execute `df['ticker'].unique()` to get the complete list.
        Format the output diligently as a markdown table showing the comparison of key metrics.
        If the user asks for specific metrics, focus on those.
        """
    )
    
    try:
        response = agent.invoke(query)
        return response['output']
    except Exception as e:
        return f"Error executing financial comparison: {str(e)}"

@tool
def diagnostic_tool(ticker: str) -> str:
    """
    Diagnoses issues with a specific ticker by checking alignment flags in narratives.json.
    Input should be the ticker symbol (e.g., 'AAPL').
    """
    try:
        if not os.path.exists(JSON_PATH):
            return "Error: narratives.json not found."

        with open(JSON_PATH, 'r') as f:
            data = json.load(f)
        
        # Look for the ticker
        record = next((item for item in data if item["ticker"].upper() == ticker.upper()), None)
        
        if not record:
            return f"No narrative data found for ticker {ticker}."
        
        # Check alignment_flag
        # Prompt says: "If it detects a mismatch (e.g., flag == False or label == 0)"
        # verification logic: if alignment_flag is False (mismatch), warn.
        # But wait, the prompt says "return a specific string: 'Consistency Warning...'"
        
        if record.get("alignment_flag") is False:
             return "Consistency Warning: The financial growth rate contradicts the textual sentiment."
        
        return f"Trust score analysis for {ticker}: Data appears consistent. Alignment flag is valid."
            
    except Exception as e:
        return f"Error in diagnosis: {str(e)}"

class DocumentRAGTool:
    def __init__(self):
        self.documents = []
        self._load_documents()

    def _load_documents(self):
        """Load narratives from JSON into simple text documents."""
        if os.path.exists(JSON_PATH):
            with open(JSON_PATH, 'r') as f:
                data = json.load(f)
                for item in data:
                    content = f"Ticker: {item.get('ticker')}. Transcript: {item.get('transcript')}"
                    self.documents.append({
                        'content': content,
                        'ticker': item.get('ticker')
                    })

    def search(self, query: str) -> str:
        """
        Simple keyword-based search for relevant information.
        """
        if not self.documents:
            return "No documents indexed."
        
        query_lower = query.lower()
        results = []
        
        for doc in self.documents:
            score = 0
            content_lower = doc['content'].lower()
            for word in query_lower.split():
                if len(word) > 3:
                    score += content_lower.count(word)
            
            if score > 0:
                results.append((score, doc))
        
        results.sort(reverse=True, key=lambda x: x[0])
        top_results = results[:3]
        
        if not top_results:
            return "No relevant information found."
        
        return "\n\n".join([doc['content'] for _, doc in top_results])

# Instantiate the RAG tool wrapper
rag_tool_instance = DocumentRAGTool()

@tool
def document_rag_tool(query: str) -> str:
    """
    Retrieves relevant information from financial narratives and documents.
    Use this for general questions, risk analysis, or qualitative info.
    """
    return rag_tool_instance.search(query)
