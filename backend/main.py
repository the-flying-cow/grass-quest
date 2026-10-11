from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
from pathlib import Path
from dotenv import dotenv_values, load_dotenv
from gradio_client import Client

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
load_dotenv(ENV_FILE)
dotenv_config = dotenv_values(ENV_FILE)
HF_USERNAME = os.getenv("HF_USERNAME") or dotenv_config.get("USERNAME")
HF_SPACE_NAME = os.getenv("HF_SPACE_NAME") or dotenv_config.get("SPACE_NAME")
HF_TOKEN = os.getenv("HF_TOKEN")

app = FastAPI(title="GrassQuest Backend", version="1.0")

cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["POST"],
        allow_headers=["Content-Type"],
    )

# Pydantic Model for Quest Submission Validation
class QuestSubmissionResponse(BaseModel):
    status: str
    latitude: float
    longitude: float
    reflection: str
    element: str
    message: str

frontend_path = os.path.join(os.path.dirname(__file__), "../frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
def serve_frontend():
    return FileResponse(os.path.join(frontend_path, "explorerScreen.html"))


@app.get("/app", include_in_schema=False)
def serve_frontend():
    frontend_file = Path(__file__).resolve().parent.parent / "frontend" / "explorerScreen.html"
    return FileResponse(frontend_file)


@app.get("/fogmap.js", include_in_schema=False)
def serve_fog_map_script():
    fog_map_script = Path(__file__).resolve().parent.parent / "frontend" / "fogmap.js"
    return FileResponse(fog_map_script, media_type="text/javascript")


@app.post("/api/submit-quest",
           response_model=QuestSubmissionResponse,
           description="Classify a text reflection submitted with the user's coordinates.")
def submit_quest(
    latitude: float = Form(..., description="User latitude"),
    longitude: float = Form(..., description="User longitude"),
    reflection: str = Form(..., description="The user's 2-line reflection")
):
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise HTTPException(
            status_code=422,
            detail="Latitude must be between -90 and 90 and longitude between -180 and 180.",
        )

    reflection = reflection.strip()
    if not reflection:
        raise HTTPException(status_code=422, detail="Reflection cannot be empty.")

    if not HF_USERNAME or not HF_SPACE_NAME or not HF_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Configure HF_USERNAME, HF_SPACE_NAME, and HF_TOKEN before submitting quests.",
        )

    try:
        client = Client(f"{HF_USERNAME}/{HF_SPACE_NAME}", token=HF_TOKEN)
        result = client.predict(
            reflection_text=reflection,
            api_name="/classify_reflection",
        )

        element_class = str(result)

        return {
            "status": "success",
            "latitude": latitude,
            "longitude": longitude,
            "reflection": reflection,
            "element": element_class,
            "message": f"Quest analyzed! You unlocked {element_class}."
        }
        
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="The reflection classifier is unavailable. Please try again later.",
        )
