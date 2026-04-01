from pydantic import BaseModel
from typing import Optional, List


class RouteRequest(BaseModel):
    query: str
    latitude: float
    longitude: float


class RouteConstraints(BaseModel):
    distance_miles: float
    max_elevation_gain_ft: float
    route_type: str
    surface: Optional[str] = "any"
    prefer_parks: bool = False
    avoid_busy_roads: bool = False
    direction_hint: Optional[str] = None
    notes: Optional[str] = None


class ElevationPoint(BaseModel):
    distance_miles: float
    elevation_ft: float


class RouteResponse(BaseModel):
    geojson: dict
    gpx: str
    distance_miles: float
    elevation_gain_ft: float
    elevation_profile: List[ElevationPoint]
    constraints: RouteConstraints
