from typing import TypedDict, Annotated, Sequence, Union
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
import operator
import os
from dotenv import load_dotenv

load_dotenv()

# Import our custom tools
try:
    from src.tools import financial_comparator_tool, diagnostic_tool, document_rag_tool
except ImportError:
    from tools import financial_comparator_tool, diagnostic_tool, document_rag_tool

# --- State Definition ---
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    context: str # to store tool outputs or additional context if needed

groq_api_key = os.getenv("GROQ_API_KEY") or "gsk_dummy_placeholder_for_init"
groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
llm = ChatGroq(
    model=groq_model,
    temperature=0.1,
    groq_api_key=groq_api_key
)

# Bind tools to the LLM for the router
tools = [financial_comparator_tool, diagnostic_tool, document_rag_tool]
llm_with_tools = llm.bind_tools(tools)

# --- Nodes ---

def router_node(state: AgentState):
    """
    Node 1 (Router/Reasoning): Decides which tool to call.
    """
    messages = state["messages"]
    
    system_prompt = """You are a specialized financial analyst for 'Kratos AI'. 
    Kratos AI is a market intelligence platform that provides financial comparisons, trust scores, and narrative analysis to help investors and founders make informed decisions.
    
    GUIDELINES:
    1. If the user asks about Kratos AI, the website, or its features, answer directly using the description above.
    2. If the user asks to compare companies OR to list available companies, use the 'financial_comparator_tool'.
    3. If the user asks about trust scores, consistency, or alignment, use the 'diagnostic_tool'.
    4. For general questions about the provided narratives or documents, use the 'document_rag_tool'.
    
    CRITICAL:
    - You must NOT answer questions about general world knowledge, celebrities (e.g., Elon Musk), sports, or anything outside the provided financial context or the platform itself.
    - If a user asks an unrelated question, politely refuse by saying: "I am a market intelligence agent designed to analyze financial data and narratives. I cannot answer general knowledge questions."
    """
    
    # We want to maintain history, so we prepend system prompt 
    # or ensure it's in the messages.
    # For simplicity, we just pass the messages to the tool-bound LLM.
    # We prepend the system prompt if it's not the first message.
    
    conversation = [SystemMessage(content=system_prompt)] + list(messages)
    
    response = llm_with_tools.invoke(conversation)
    return {"messages": [response]}

def tool_execution_node(state: AgentState):
    """
    Node 2 (Tool Execution): Handled by LangGraph's prebuilt ToolNode 
    but we can customize if needed. For this plan, we will use the prebuilt
    ToolNode but wrap it effectively in the graph definition.
    
    However, the prompt asks for specific nodes. Let's use the prebuilt ToolNode 
    mechanism which is standard for 'executing tools'.
    """
    pass # This logic is handled by the prebuilt ToolNode in the graph definition

def generation_node(state: AgentState):
    """
    Node 3 (Generation): Synthesize the final answer from tool outputs.
    """
    messages = state["messages"]
    user_query = ""
    for msg in messages:
        if isinstance(msg, HumanMessage) or getattr(msg, "type", "") == "human":
            user_query = str(msg.content)
            break
    if not user_query and messages:
        user_query = str(messages[0].content)
        
    # Extract tool outputs
    tool_outputs = []
    for msg in messages:
        msg_type = getattr(msg, "type", "")
        if msg_type == "tool" or msg.__class__.__name__ == "ToolMessage":
            tool_outputs.append(str(msg.content))
            
    tool_context = "\n\n".join(tool_outputs) if tool_outputs else "No tool output available."
    
    synthesis_prompt = f"""You are a specialized financial analyst for Kratos AI.
Here is the data and context retrieved from the platform:

{tool_context}

User Question: "{user_query}"

INSTRUCTIONS:
1. Provide a comprehensive, professional, and clear answer using the data above.
2. If metrics were retrieved, format them cleanly using Markdown tables and bullet points.
3. Compare the requested metrics (e.g. RSI, MACD, Moving Averages, Volatility, P/E) concisely.
4. Do not mention internal tool names or internal function calls."""

    response = llm.invoke([HumanMessage(content=synthesis_prompt)])
    return {"messages": [response]}

# --- Graph Definition ---

def should_continue(state: AgentState):
    """
    Determine the next node:
    - If the Router generated a tool call -> go to 'tools'
    - If no tool call -> go to 'generation' (or END directly if it was a direct answer)
    - From 'tools' -> go to 'generation'
    """
    messages = state["messages"]
    last_message = messages[-1]
    
    # Check if there are tool calls
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        return "tools"
    return END

workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("router", router_node)
workflow.add_node("tools", ToolNode(tools)) # Using prebuilt ToolNode for execution
workflow.add_node("generation", generation_node)

# Add Edges
workflow.set_entry_point("router")

# Conditional edge from router:
# If tool call -> tools
# Else -> generation (or END) - Let's verify instructions.
# "Edges: Reasoning -> Tools -> Generation -> END"
# This implies a linear flow, but reasoning might skip tools if not needed.
# For strictly following the prompt's linear suggestion for the critical path:
workflow.add_conditional_edges(
    "router",
    should_continue,
    {
        "tools": "tools",
        END: END
    }
)

# From Tools -> Generation
workflow.add_edge("tools", "generation")

# From Generation -> END
workflow.add_edge("generation", END)

# Compile
app = workflow.compile()