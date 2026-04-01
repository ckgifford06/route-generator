import os
import math
import httpx
import xml.etree.ElementTree as ET
from typing import Optional
from app.models import RouteConstraints, RouteResponse, ElevationPoint
import random

ORS_BASE = "https://api.openrouteservice.org/v2/directions/foot-walking/geojson"
METERS_PER_MILE = 1609.34


async def _request_route_loop(lat, lng, target_m, seed=1, constraints=None) -> Optional[dict]:
    headers = {
        "Authorization": os.getenv("ORS_API_KEY"),
        "Content-Type": "application/json",
    }
    options = {
        "round_trip": {
            "length": target_m,
            "points": 5,
            "seed": seed,
        }
    }
    avoid_features = []
    if constraints and constraints.avoid_busy_roads:
        avoid_features.append("highways")
    if constraints and constraints.surface == "paved":
        avoid_features.append("ferries")
    if avoid_features:
        options["avoid_features"] = avoid_features

    body = {
        "coordinates": [[lng, lat]],
        "options": options,
        "instructions": False,
        "elevation": True,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(ORS_BASE, headers=headers, json=body)
        if resp.status_code != 200:
            print(f"ORS loop error: {resp.status_code} {resp.text[:200]}")
            return None
        data = resp.json()
        return data["features"][0] if data.get("features") else None


async def _request_route_out_and_back(lat, lng, target_m, angle_deg, constraints=None) -> Optional[dict]:
    half_m = target_m / 2
    angle_rad = math.radians(angle_deg)
    dlat = (half_m / 111_320) * math.cos(angle_rad)
    dlng = (half_m / (111_320 * math.cos(math.radians(lat)))) * math.sin(angle_rad)
    turn_lng = lng + dlng
    turn_lat = lat + dlat

    headers = {
        "Authorization": os.getenv("ORS_API_KEY"),
        "Content-Type": "application/json",
    }
    options = {}
    avoid_features = []
    if constraints and constraints.avoid_busy_roads:
        avoid_features.append("highways")
    if constraints and constraints.surface == "paved":
        avoid_features.append("ferries")
    if avoid_features:
        options["avoid_features"] = avoid_features

    body = {
        "coordinates": [[lng, lat], [turn_lng, turn_lat]],
        "options": options,
        "instructions": False,
        "elevation": True,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(ORS_BASE, headers=headers, json=body)
        if resp.status_code != 200:
            print(f"ORS out-and-back error: {resp.status_code} {resp.text[:200]}")
            return None
        data = resp.json()
        feature = data["features"][0] if data.get("features") else None
        if not feature:
            return None

    coords = feature["geometry"]["coordinates"]
    feature["geometry"]["coordinates"] = coords + list(reversed(coords[:-1]))
    feature["properties"]["summary"]["distance"] *= 2
    return feature


def _route_distance_miles(feature: dict) -> float:
    return feature["properties"]["summary"]["distance"] / METERS_PER_MILE


def _haversine_m(a, b) -> float:
    lat1, lng1 = math.radians(a[1]), math.radians(a[0])
    lat2, lng2 = math.radians(b[1]), math.radians(b[0])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


def _elevation_data(coords: list) -> tuple[float, list[ElevationPoint]]:
    if not coords or len(coords[0]) < 3:
        return 0.0, []

    sampled = coords[::4]
    if coords[-1] not in sampled:
        sampled.append(coords[-1])

    cumulative_m = 0.0
    gain_m = 0.0
    profile = []

    for i, coord in enumerate(sampled):
        elev_m = coord[2]
        if i > 0:
            cumulative_m += _haversine_m(sampled[i - 1], coord)
            diff = elev_m - sampled[i - 1][2]
            if diff > 0:
                gain_m += diff
        profile.append(ElevationPoint(
            distance_miles=round(cumulative_m / METERS_PER_MILE, 3),
            elevation_ft=round(elev_m * 3.28084, 1),
        ))

    return gain_m * 3.28084, profile


def _build_gpx(coords: list, name: str = "My Route") -> str:
    root = ET.Element("gpx", version="1.1", creator="RouteGenerator")
    trk = ET.SubElement(root, "trk")
    ET.SubElement(trk, "name").text = name
    trkseg = ET.SubElement(trk, "trkseg")
    for coord in coords:
        ET.SubElement(trkseg, "trkpt", lat=str(coord[1]), lon=str(coord[0]))
    return ET.tostring(root, encoding="unicode", xml_declaration=True)


async def generate_route(lat: float, lng: float, constraints: RouteConstraints) -> RouteResponse:
    target_m = constraints.distance_miles * METERS_PER_MILE
    is_loop = constraints.route_type != "out-and-back"

    DISTANCE_TOLERANCE = 0.15
    MAX_ITERATIONS = 8
    candidates = []

    for i in range(MAX_ITERATIONS):
        if is_loop:
            seed = random.randint(1, 9999)
            feature = await _request_route_loop(lat, lng, target_m, seed=seed, constraints=constraints)
        else:
            angle = random.uniform(0, 360)
            feature = await _request_route_out_and_back(lat, lng, target_m, angle_deg=angle, constraints=constraints)

        if feature is None:
            continue

        actual_miles = _route_distance_miles(feature)
        if abs(actual_miles - constraints.distance_miles) / constraints.distance_miles > DISTANCE_TOLERANCE:
            continue

        coords = feature["geometry"]["coordinates"]
        try:
            gain_ft, profile = _elevation_data(coords)
        except Exception as e:
            print(f"Elevation error: {e}")
            gain_ft, profile = 0.0, []

        candidates.append({
            "feature": feature,
            "coords": coords,
            "distance_miles": actual_miles,
            "elevation_gain_ft": gain_ft,
            "elevation_profile": profile,
        })

    if not candidates:
        raise ValueError("Could not generate a valid route. Try adjusting your constraints.")

    best = min(candidates, key=lambda c: c["elevation_gain_ft"])
    gpx = _build_gpx(best["coords"], name=f"{constraints.distance_miles:.1f} Mile Run")

    return RouteResponse(
        geojson=best["feature"]["geometry"],
        gpx=gpx,
        distance_miles=round(best["distance_miles"], 2),
        elevation_gain_ft=round(best["elevation_gain_ft"]),
        elevation_profile=best["elevation_profile"],
        constraints=constraints,
    )