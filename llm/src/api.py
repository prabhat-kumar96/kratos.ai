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
from src.agent import app as agent_app

# Initialize FastAPI
app = FastAPI(title="Aletheia AI Chatbot")

class ChatRequest(BaseModel):
    query: str
    ticker: Optional[str] = None

class ChatResponse(BaseModel):
    response: str

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Endpoint to interact with the Aletheia AI Agent.
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
        
        # Run the graph
        # invoke returns the final state
        final_state = agent_app.invoke(inputs)
        
        # Extract the last message content
        messages = final_state.get("messages", [])
        if not messages:
            return ChatResponse(response="No response generated.")
            
        last_message = messages[-1]
        content = last_message.content
        
        return ChatResponse(response=content)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Ensure we run relative to llm/src if run directly
    uvicorn.run(app, host="0.0.0.0", port=8002)
