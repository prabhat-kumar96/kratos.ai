import os
import re
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

groq_api_key = os.getenv("GROQ_API_KEY") or "gsk_dummy_placeholder_for_init"
groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
llm = ChatGroq(
    model=groq_model,
    temperature=0.1,
    groq_api_key=groq_api_key
)

COMPANY_NAME_MAP = {
    "APPLE": "AAPL",
    "NVIDIA": "NVDA",
    "MICROSOFT": "MSFT",
    "GOOGLE": "GOOGL",
    "ALPHABET": "GOOGL",
    "AMAZON": "AMZN",
    "TESLA": "TSLA",
    "META": "META",
    "FACEBOOK": "META",
    "NETFLIX": "NFLX",
    "WALMART": "WMT",
    "DISNEY": "DIS",
    "PALANTIR": "PLTR",
    "AMD": "AMD",
    "ADVANCED MICRO DEVICES": "AMD",
    "INTEL": "INTC",
    "MICRON": "MU",
    "ICICI": "IBN",
    "HDFC": "HDB",
    "INFOSYS": "INFY",
    "WIPRO": "WIT",
    "HSBC": "HSBC",
    "JPMORGAN": "JPM",
    "VISA": "V",
    "MASTERCARD": "MA",
    "COINBASE": "COIN",
    "ARM": "ARM",
    "SNOWFLAKE": "SNOW",
    "CROWDSTRIKE": "CRWD",
    "SHOPIFY": "SHOP",
    "UBER": "UBER",
    "AIRBNB": "ABNB",
    "SPOTIFY": "SPOT",
    "ROBLOX": "RBLX",
    "RIVIAN": "RIVN",
    "BOEING": "BA",
    "ELI LILLY": "LLY",
    "COCA COLA": "KO"
}

@tool
def financial_comparator_tool(query: str) -> str:
    """
    Useful for comparing financial metrics between companies (tickers), listing available companies, 
    or querying key indicators (Price, RSI, MACD, 50 SMA, 200 SMA, P/E Ratio, Volatility) from market_data.csv.
    Can handle queries like 'Compare AAPL and AMD', 'List metrics of AMD and compare with NVIDIA', or 'What companies are in the data?'.
    """
    try:
        if not os.path.exists(CSV_PATH):
            return "Error: market_data.csv not found."
            
        df = pd.read_csv(CSV_PATH)
        all_tickers = [str(t).upper() for t in df['ticker'].unique()]
        
        # Check if user asks for list of companies/tickers
        q_lower = query.lower()
        if any(w in q_lower for w in ["list companies", "available companies", "what companies", "all tickers", "list tickers"]):
            return f"Available companies in Kratos AI dataset ({len(all_tickers)} total):\n" + ", ".join(all_tickers)
            
        # Detect tickers and company names in query
        found_tickers = []
        words = re.findall(r'[A-Za-z0-9\.\-]+', query)
        for w in words:
            w_upper = w.upper()
            if w_upper in all_tickers and w_upper not in found_tickers:
                found_tickers.append(w_upper)
            elif w_upper in COMPANY_NAME_MAP:
                mapped = COMPANY_NAME_MAP[w_upper]
                if mapped in all_tickers and mapped not in found_tickers:
                    found_tickers.append(mapped)
                    
        # Check full company names
        for name, tick in COMPANY_NAME_MAP.items():
            if name.lower() in q_lower and tick in all_tickers and tick not in found_tickers:
                found_tickers.append(tick)
                
        if not found_tickers:
            # Fallback to top tickers if none detected
            found_tickers = ["AMD", "NVDA"] if "AMD" in q_lower or "NVDA" in q_lower or "NVIDIA" in q_lower else all_tickers[:5]

        # Extract latest records for the found tickers
        filtered = df[df['ticker'].isin(found_tickers)].copy()
        if filtered.empty:
            return f"No records found in dataset for tickers: {found_tickers}"
            
        latest_df = filtered.sort_values('date').groupby('ticker').last().reset_index()
        
        # Select key financial and technical columns
        target_cols = [
            'ticker', 'date', 'close', 'rsi', 'macd', 'macd_signal', 
            'sma_50', 'sma_200', 'pe_ratio', 'debt_to_equity', 'quick_ratio', 
            'volatility_5d', 'return_5d_forward'
        ]
        available_cols = [c for c in target_cols if c in latest_df.columns]
        summary_table = latest_df[available_cols].to_markdown(index=False)
        
        return f"Market Data & Financial Metrics Table:\n\n{summary_table}"
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
