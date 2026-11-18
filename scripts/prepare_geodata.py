#!/usr/bin/env python3
"""
Prepare official IBGE municipal boundaries GeoJSON for Paraná (UF 41 - 399 municipalities).

Data sources (Public Domain / Official Brazilian Government Open Data - IBGE):
- Mesh v3: https://servicodados.ibge.gov.br/api/v3/malhas/estados/41?intrarregiao=municipio&qualidade=intermediaria&formato=application/vnd.geo+json
- Localities v1: https://servicodados.ibge.gov.br/api/v1/localidades/estados/41/municipios
- Metadata v3: https://servicodados.ibge.gov.br/api/v3/malhas/estados/41/metadados?intrarregiao=municipio
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

try:
    import requests  # type: ignore[import-not-found]
except ImportError:
    requests = None

LOGGER = logging.getLogger("pinhal.geodata")

EXPECTED_MUNICIPALITIES = 399
PARANA_UF_CODE = "41"

IBGE_MESH_URL = (
    f"https://servicodados.ibge.gov.br/api/v3/malhas/estados/{PARANA_UF_CODE}"
    "?intrarregiao=municipio&qualidade=intermediaria&formato=application/vnd.geo+json"
)
IBGE_LOCALITIES_URL = (
    f"https://servicodados.ibge.gov.br/api/v1/localidades/estados/{PARANA_UF_CODE}/municipios"
)
IBGE_METADATA_URL = (
    f"https://servicodados.ibge.gov.br/api/v3/malhas/estados/{PARANA_UF_CODE}/metadados"
    "?intrarregiao=municipio"
)

USER_AGENT = "PinhalGeoDataBuilder/1.0 (+https://github.com/andreysilveira/pinhal)"


def fetch_json(url: str, timeout: int = 30, retries: int = 3) -> Any:
    """Fetch JSON from URL using requests if available, falling back to urllib."""
    headers = {
        "Accept": "application/json, application/vnd.geo+json",
        "User-Agent": USER_AGENT,
    }
    last_error: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            if requests is not None:
                response = requests.get(url, headers=headers, timeout=timeout)
                response.raise_for_status()
                return response.json()

            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = resp.read().decode("utf-8")
                return json.loads(payload)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            LOGGER.warning("Attempt %d/%d failed for %s: %s", attempt, retries, url, exc)
            if attempt < retries:
                time.sleep(1.5 * attempt)

    raise RuntimeError(f"Failed to fetch {url} after {retries} attempts: {last_error}")


def round_coordinates(coords: Any, precision: int = 5) -> Any:
    """Recursively round GeoJSON coordinate arrays to keep file size compact."""
    if isinstance(coords, (int, float)):
        return round(float(coords), precision)
    if isinstance(coords, list):
        return [round_coordinates(item, precision) for item in coords]
    return coords


def extract_region_name(item: dict[str, Any]) -> str:
    """Extract immediate geographic region or microregion name from IBGE locality payload."""
    regiao_imediata = item.get("regiao-imediata") or {}
    if isinstance(regiao_imediata, dict) and regiao_imediata.get("nome"):
        return str(regiao_imediata["nome"])

    microrregiao = item.get("microrregiao") or {}
    if isinstance(microrregiao, dict) and microrregiao.get("nome"):
        return str(microrregiao["nome"])

    return "Paraná"


def compute_fallback_centroid(geometry: dict[str, Any]) -> tuple[float, float]:
    """Compute simple bounding-box midpoint if official centroid metadata is missing."""
    lons: list[float] = []
    lats: list[float] = []

    def collect(node: Any) -> None:
        if isinstance(node, list) and len(node) >= 2 and isinstance(node[0], (int, float)):
            lons.append(float(node[0]))
            lats.append(float(node[1]))
        elif isinstance(node, list):
            for child in node:
                collect(child)

    collect(geometry.get("coordinates", []))
    if not lons or not lats:
        raise ValueError("Cannot compute centroid from empty geometry")
    return round((min(lons) + max(lons)) / 2.0, 5), round((min(lats) + max(lats)) / 2.0, 5)


def build_municipalities_geojson(output_path: Path, precision: int = 5) -> dict[str, Any]:
    """Download, validate, enrich, and write the 399 Paraná municipalities GeoJSON."""
    LOGGER.info("Fetching official Paraná municipal boundaries from IBGE Malhas v3...")
    mesh_geojson = fetch_json(IBGE_MESH_URL)

    LOGGER.info("Fetching official municipality names from IBGE Localidades v1...")
    localities = fetch_json(IBGE_LOCALITIES_URL)

    LOGGER.info("Fetching official centroids and areas from IBGE Metadados v3...")
    metadata_list = fetch_json(IBGE_METADATA_URL)

    if not isinstance(mesh_geojson, dict) or mesh_geojson.get("type") != "FeatureCollection":
        raise ValueError("Invalid GeoJSON FeatureCollection returned by IBGE Malhas API")

    locality_by_id: dict[str, dict[str, Any]] = {}
    for loc in localities:
        ibge_id = str(loc.get("id", "")).strip()
        if ibge_id:
            locality_by_id[ibge_id] = {
                "name": str(loc.get("nome", "")).strip(),
                "regionName": extract_region_name(loc),
            }

    meta_by_id: dict[str, dict[str, Any]] = {}
    for meta in metadata_list:
        ibge_id = str(meta.get("id", "")).strip()
        centroide = meta.get("centroide") or {}
        area_obj = meta.get("area") or {}
        if ibge_id:
            meta_by_id[ibge_id] = {
                "lon": float(centroide["longitude"]) if "longitude" in centroide else None,
                "lat": float(centroide["latitude"]) if "latitude" in centroide else None,
                "areaKm2": round(float(area_obj["dimensao"]), 2)
                if area_obj.get("dimensao") is not None
                else None,
            }

    raw_features = mesh_geojson.get("features", [])
    if len(raw_features) != EXPECTED_MUNICIPALITIES:
        raise ValueError(
            f"Expected {EXPECTED_MUNICIPALITIES} features for Paraná, got {len(raw_features)}"
        )

    enriched_features: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for feature in raw_features:
        props = feature.get("properties") or {}
        ibge_id = str(props.get("codarea") or feature.get("id") or "").strip()
        if not ibge_id or not ibge_id.startswith(PARANA_UF_CODE) or len(ibge_id) != 7:
            raise ValueError(f"Invalid IBGE municipality code in mesh: {ibge_id!r}")
        if ibge_id in seen_ids:
            raise ValueError(f"Duplicate IBGE municipality code found: {ibge_id}")
        seen_ids.add(ibge_id)

        locality = locality_by_id.get(ibge_id)
        if not locality or not locality["name"]:
            raise ValueError(f"Missing official municipality name for IBGE code {ibge_id}")

        geometry = feature.get("geometry")
        if not isinstance(geometry, dict) or geometry.get("type") not in ("Polygon", "MultiPolygon"):
            raise ValueError(f"Invalid geometry for municipality {ibge_id}")

        meta = meta_by_id.get(ibge_id, {})
        lon = meta.get("lon")
        lat = meta.get("lat")
        if lon is None or lat is None:
            lon, lat = compute_fallback_centroid(geometry)
        else:
            lon = round(float(lon), 5)
            lat = round(float(lat), 5)

        enriched_features.append(
            {
                "type": "Feature",
                "id": ibge_id,
                "properties": {
                    "municipalityId": ibge_id,
                    "municipalityName": locality["name"],
                    "regionName": locality["regionName"],
                    "centroidLon": lon,
                    "centroidLat": lat,
                    "areaKm2": meta.get("areaKm2"),
                },
                "geometry": {
                    "type": geometry["type"],
                    "coordinates": round_coordinates(geometry["coordinates"], precision=precision),
                },
            }
        )

    enriched_features.sort(key=lambda f: f["properties"]["municipalityId"])

    output_collection: dict[str, Any] = {
        "type": "FeatureCollection",
        "metadata": {
            "state": "Paraná",
            "uf": "PR",
            "ibgeStateCode": PARANA_UF_CODE,
            "municipalityCount": len(enriched_features),
            "crs": "EPSG:4326",
            "source": "IBGE - Instituto Brasileiro de Geografia e Estatística (Malhas v3 & Localidades v1)",
            "sourceUrl": "https://servicodados.ibge.gov.br/",
        },
        "features": enriched_features,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = output_path.with_suffix(".geojson.tmp")
    temp_path.write_text(
        json.dumps(output_collection, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    temp_path.replace(output_path)

    size_kb = output_path.stat().st_size / 1024.0
    LOGGER.info(
        "Successfully wrote %d Paraná municipalities to %s (%.1f KB)",
        len(enriched_features),
        output_path,
        size_kb,
    )
    return output_collection


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    parser = argparse.ArgumentParser(
        description="Build Paraná 399 municipalities GeoJSON from official IBGE APIs."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "public" / "data" / "municipalities.geojson",
        help="Destination path for municipalities.geojson",
    )
    parser.add_argument(
        "--precision",
        type=int,
        default=5,
        help="Coordinate decimal precision (default: 5, ~1.1m accuracy)",
    )
    args = parser.parse_args()

    try:
        build_municipalities_geojson(args.output, precision=args.precision)
        return 0
    except Exception as exc:  # noqa: BLE001
        LOGGER.error("Failed to prepare GeoJSON: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
