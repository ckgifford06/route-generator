from fastapi import APIRouter, HTTPException
from app.models import RouteRequest, RouteResponse
from app.services.claude_service import parse_route_constraints
from app.services.route_service import generate_route
import traceback

router = APIRouter(prefix="/routes", tags=["routes"])




@router.post("/generate", response_model=RouteResponse)
async def generate_running_route(request: RouteRequest):
    try:
        constraints = await parse_route_constraints(request.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse route request: {str(e)}")

    try:
        route = await generate_route(request.latitude, request.longitude, constraints)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Route generation failed: {str(e)}")

    return route
