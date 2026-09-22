import os
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

# Load environment variables
from pathlib import Path

# Load environment variables
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
# Also load local .env if exists (overrides)
load_dotenv()

# Import the LangGraph app
try:
    from src.agent import app as agent_app
except ImportError:
    from agent import app as agent_app

# Initialize FastAPI
app = FastAPI(title="Kratos AI Chatbot")

@app.get("/")
def root():
    return {"status": "ok", "service": "kratos-llm"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

class ChatRequest(BaseModel):
    query: str
    ticker: Optional[str] = None

class ChatResponse(BaseModel):
    response: str

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Endpoint to interact with the Kratos AI Agent.
    """
    try:
        # Prepare initial state
        # Context can store the ticker if needed for some future logic, 
        # though the tools currently extract ticker from query usually.
        # But DiagnosticTool takes 'ticker' input. 
        # If the user provides ticker explicitly, we might want to mention it in the system prompt or query?
        # The prompt says: Input: {"query": "Compare AAPL and AMD", "ticker": "AAPL" (optional)}
        
        # We'll include the query as a HumanMessage.
        inputs = {
            "messages": [HumanMessage(content=request.query)],
            "context": request.ticker if request.ticker else ""
        }
        
        # Run the graph — invoke returns the final state
        final_state = agent_app.invoke(inputs)
        
        # Extract the last message content
        messages = final_state.get("messages", [])
        if not messages:
            return ChatResponse(response="No response generated.")
        
        last_message = messages[-1]
        content = last_message.content

        # content can be a list of dicts when Groq returns tool_call blocks
        # e.g. [{"type": "text", "text": "..."}, {"type": "tool_use", ...}]
        if isinstance(content, list):
            text_parts = [
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in content
                if not (isinstance(part, dict) and part.get("type") == "tool_use")
            ]
            content = " ".join(text_parts).strip()

        # If still empty (router went to END with no direct answer), give a fallback
        if not content or not str(content).strip():
            content = "I was unable to generate a response. Please try rephrasing your question."

        return ChatResponse(response=str(content))
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"[Chat Error] {str(e)}\n{error_detail}")
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

if __name__ == "__main__":
    # Ensure we run relative to llm/src if run directly
    uvicorn.run(app, host="0.0.0.0", port=8002)
