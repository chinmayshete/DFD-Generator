import os
import json
import httpx
from fastapi import FastAPI, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="DFD Generator API")

# Ensure static directory exists
os.makedirs("static", exist_ok=True)

# Mount static files to serve HTML, CSS, JS
app.mount("/static", StaticFiles(directory="static"), name="static")

class GenerateRequest(BaseModel):
    requirements: str = Field(..., description="The user requirements text to translate into DFD")

@app.get("/", response_class=HTMLResponse)
async def read_index():
    # Serve index.html from static folder at root path
    return FileResponse("static/index.html")

@app.get("/api/status")
async def get_status():
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    
    config_ok = bool(endpoint and api_key)
    
    return {
        "status": "configured" if config_ok else "unconfigured",
        "has_endpoint": bool(endpoint),
        "has_key": bool(api_key),
    }

@app.post("/api/generate")
async def generate_dfd(data: GenerateRequest):
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    
    if not endpoint or not api_key:
        raise HTTPException(status_code=500, detail="Azure OpenAI API key or endpoint not configured in .env file.")
    
    system_prompt = (
        "You are an expert systems architect and diagram engineer.\n"
        "Your task is to convert the user's system workflow descriptions into an accurate, clean, and professional high-level Data Flow Diagram (DFD).\n"
        "You must respond with a JSON object ONLY. Do not include any conversational preamble or postscript.\n\n"
        "The JSON object must have this exact schema:\n"
        "{\n"
        '  "title": "A short, generic, and professional title for the diagram (do not include specific proprietary system names like CCR, etc.)",\n'
        '  "description": "An extremely short, generic, and concise explanation of the data flow (maximum 1 sentence)",\n'
        '  "mermaid": "Valid Mermaid.js flowchart source code. Use flowchart TD or LR. Follow these formatting and shape rules strictly:\\n'
        '    - ALWAYS wrap ALL node labels in double quotes (\\\") inside their shapes to prevent parsing errors.\\n'
        '    - Split long labels (more than 4 words) into multiple lines using HTML breaks <br/> to keep shapes compact and highly readable (e.g. \\\"CCRTracking.dbo.up_SubmitLoadControl<br/>Generate loadIDs & Sanity checks\\\").\\n'
        '    - Databases, SQL tables, and data stores (cylindrical shape): ALWAYS use the syntax nodeId[(\\\"Label Text\\\")] (e.g. SourceFile[(\\\"CCRTracking.dbo.SourceFile\\\")]). NEVER use double parentheses ((...)) for data stores.\\n'
        '    - Decisions (diamond shape): Use nodeId{\\\"Label Text\\\"} (e.g. TransformNeeded{\\\"Does data need transformation?\\\"}).\\n'
        '    - Processes, jobs, inputs, start, and end nodes (stadium shape): Use nodeId([\\\"Label Text\\\"]) (e.g. Start([\\\"Start\\\"]), FileUploader([\\\"FileUploader detects new file\\\"])).\\n'
        '    - ALWAYS define and apply visual class styling at the end of the Mermaid code to color-code components. Include the following class definitions and apply them to all nodes (do not add any custom fill or stroke colors here, keep them exactly as shown below):\\n'
        '      classDef process stroke-width:2px;\\n'
        '      classDef datastore stroke-width:2px;\\n'
        '      classDef decision stroke-width:2px;\\n'
        '      classDef startend stroke-width:2px;\\n'
        '      class Node1,Node2 process;\\n'
        '      class Node3 datastore;\\n'
        '      class Node4 decision;\\n'
        '      class Node5 startend;\",\n'
        '  "components": [\n'
        "    {\n"
        '      "name": "Exact component or process name",\n'
        '      "type": "Process | Data Store | External Entity | Decision | Start/End",\n'
        '      "description": "A brief explanation of its role in the flow"\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    user_prompt = f"Analyze these requirements and generate the DFD JSON:\n\n{data.requirements}"
    
    headers = {
        "api-key": api_key,
        "Content-Type": "application/json"
    }
    
    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1,
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(endpoint, json=payload, headers=headers, timeout=60.0)
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"Azure OpenAI API returned error: {response.text}")
            
            result = response.json()
            content = result['choices'][0]['message']['content'].strip()
            
            # Remove markdown JSON wrappers if present
            if content.startswith("```"):
                lines = content.splitlines()
                if lines[0].startswith("```json") or lines[0].startswith("```"):
                    content = "\n".join(lines[1:-1])
            
            content = content.strip()
            
            # Parse to make sure it's valid JSON
            parsed_json = json.loads(content)
            return parsed_json
            
    except json.JSONDecodeError as je:
        raise HTTPException(status_code=500, detail=f"Failed to parse model output as JSON. Output was: {content}")
    except httpx.RequestError as re:
        raise HTTPException(status_code=500, detail=f"Request to Azure OpenAI failed: {str(re)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")
