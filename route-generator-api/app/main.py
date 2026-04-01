from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import routes

load_dotenv()

import os
load_dotenv()

# Startup check
ors_key = os.getenv("ORS_API_KEY")
anthropic_key = os.getenv("ANTHROPIC_API_KEY")
print(f"ORS_API_KEY loaded: {bool(ors_key)} — {ors_key[:10] if ors_key else 'MISSING'}")
print(f"ANTHROPIC_API_KEY loaded: {bool(anthropic_key)} — {anthropic_key[:10] if anthropic_key else 'MISSING'}")

app = FastAPI(title="Route Generator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router)


@app.get("/health")
def health():
    return {"status": "ok"}
