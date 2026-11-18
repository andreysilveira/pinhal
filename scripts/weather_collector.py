#!/usr/bin/env python3
"""
Pinhal Weather Collector — Collects, validates, and normalizes meteorological data
for all 399 municipalities of Paraná, Brazil.

Primary Meteorological Source:
- Open-Meteo Weather Forecast API (https://open-meteo.com/)
  Open data licensed under Attribution 4.0 International (CC BY 4.0) for non-commercial use.
  Consolidates high-resolution global and regional NWP models (ECMWF IFS, NOAA GFS, DWD ICON).

Safety guarantees:
- Strictly associates municipalities by 7-digit IBGE code (`municipalityId`).
- Validates numerical bounds and schema completeness.
- Writes atomically via temporary file and NEVER overwrites a valid existing dataset
  with empty, corrupt, or severely degraded data.
- Never fabricates meteorological readings as real data; demo fallback is disabled by default
  and explicitly marked (`isDemo: true`, `status: "demo"`) if ever invoked offline.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import requests  # type: ignore[import-not-found]
except ImportError:
    requests = None

LOGGER = logging.getLogger("pinhal.weather")

EXPECTED_MUNICIPALITIES = 399
PARANA_UF_CODE = "41"
MIN_TEMP_BOUND_C = -35.0
MAX_TEMP_BOUND_C = 55.0

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
USER_AGENT = "PinhalWeatherCollector/1.0 (+https://github.com/andreysilveira/pinhal)"


def fetch_json(url: str, params: dict[str, str] | None = None, timeout: int = 30, retries: int = 3) -> Any:
    """Perform HTTP GET returning parsed JSON using requests (preferred) or urllib fallback."""
    headers = {
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
    }
    full_url = url
    if params:
        query = urllib.parse.urlencode(params, safe=",")
        full_url = f"{url}?{query}"

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            if requests is not None:
                response = requests.get(url, params=params, headers=headers, timeout=timeout)
                response.raise_for_status()
                return response.json()

            req = urllib.request.Request(full_url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            LOGGER.warning("HTTP attempt %d/%d failed: %s", attempt, retries, exc)
            if attempt < retries:
                time.sleep(2.0 * attempt)

    raise RuntimeError(f"Request failed after {retries} attempts: {last_error}")


def validate_temperature(value: Any) -> float | None:
    """Validate and round a single Celsius reading, returning None if missing or invalid."""
    if value is None or isinstance(value, bool):
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None

    if not math.isfinite(numeric):
        return None
    if numeric < MIN_TEMP_BOUND_C or numeric > MAX_TEMP_BOUND_C:
        LOGGER.warning("Out-of-bounds temperature discarded: %s °C", numeric)
        return None

    return round(numeric, 1)


def load_municipalities_reference(geojson_path: Path) -> list[dict[str, Any]]:
    """Load and validate municipality identifiers, names, and centroids from GeoJSON."""
    if not geojson_path.exists():
        LOGGER.info("GeoJSON %s not found; building from IBGE APIs first...", geojson_path)
        from prepare_geodata import build_municipalities_geojson

        build_municipalities_geojson(geojson_path)

    raw = json.loads(geojson_path.read_text(encoding="utf-8"))
    features = raw.get("features", [])
    if not isinstance(features, list) or len(features) != EXPECTED_MUNICIPALITIES:
        raise ValueError(
            f"GeoJSON validation failed: expected {EXPECTED_MUNICIPALITIES} features, found {len(features)}"
        )

    municipalities: list[dict[str, Any]] = []
    for feature in features:
        props = feature.get("properties") or {}
        mun_id = str(props.get("municipalityId") or feature.get("id") or "").strip()
        mun_name = str(props.get("municipalityName") or "").strip()
        lat = props.get("centroidLat")
        lon = props.get("centroidLon")

        if not mun_id.startswith(PARANA_UF_CODE) or len(mun_id) != 7 or not mun_name:
            raise ValueError(f"Invalid municipality metadata in GeoJSON: {props!r}")
        if lat is None or lon is None:
            raise ValueError(f"Missing centroid coordinates for {mun_name} ({mun_id})")

        municipalities.append(
            {
                "municipalityId": mun_id,
                "municipalityName": mun_name,
                "latitude": float(lat),
                "longitude": float(lon),
            }
        )

    municipalities.sort(key=lambda item: item["municipalityId"])
    return municipalities


def collect_open_meteo(
    municipalities: list[dict[str, Any]],
    batch_size: int = 80,
) -> tuple[list[dict[str, Any]], str]:
    """Fetch current, maximum, and minimum temperatures in batches from Open-Meteo."""
    collected_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    results: list[dict[str, Any]] = []
    latest_model_time = collected_at

    total = len(municipalities)
    for start in range(0, total, batch_size):
        batch = municipalities[start : start + batch_size]
        lat_param = ",".join(f"{m['latitude']:.4f}" for m in batch)
        lon_param = ",".join(f"{m['longitude']:.4f}" for m in batch)

        LOGGER.info(
            "Fetching Open-Meteo batch %d-%d of %d...",
            start + 1,
            min(start + batch_size, total),
            total,
        )
        payload = fetch_json(
            OPEN_METEO_FORECAST_URL,
            params={
                "latitude": lat_param,
                "longitude": lon_param,
                "current": "temperature_2m",
                "daily": "temperature_2m_max,temperature_2m_min",
                "timezone": "America/Sao_Paulo",
                "forecast_days": "1",
            },
        )

        # Open-Meteo returns a dict for a single coordinate or a list of dicts for multiple coordinates
        entries: list[dict[str, Any]] = payload if isinstance(payload, list) else [payload]
        if len(entries) != len(batch):
            raise RuntimeError(
                f"Batch length mismatch: requested {len(batch)} locations, got {len(entries)}"
            )

        for mun, entry in zip(batch, entries, strict=True):
            current_block = entry.get("current") or {}
            daily_block = entry.get("daily") or {}

            current_temp = validate_temperature(current_block.get("temperature_2m"))

            max_list = daily_block.get("temperature_2m_max") or []
            min_list = daily_block.get("temperature_2m_min") or []
            max_temp = validate_temperature(max_list[0] if max_list else None)
            min_temp = validate_temperature(min_list[0] if min_list else None)

            if min_temp is not None and max_temp is not None and min_temp > max_temp:
                min_temp, max_temp = max_temp, min_temp

            # Ensure current temperature sits coherently within daily extremes if minor model lag occurs
            if current_temp is not None:
                if max_temp is not None and current_temp > max_temp:
                    max_temp = current_temp
                if min_temp is not None and current_temp < min_temp:
                    min_temp = current_temp

            raw_time = str(current_block.get("time") or "").strip()
            updated_at = f"{raw_time}:00-03:00" if len(raw_time) == 16 else collected_at
            if updated_at:
                latest_model_time = updated_at

            results.append(
                {
                    "municipalityId": mun["municipalityId"],
                    "municipalityName": mun["municipalityName"],
                    "currentTemperature": current_temp,
                    "maximumTemperature": max_temp,
                    "minimumTemperature": min_temp,
                    "updatedAt": updated_at,
                }
            )

        if start + batch_size < total:
            time.sleep(0.25)

    return results, latest_model_time


def generate_explicit_demo_dataset(municipalities: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str]:
    """
    Generate an explicitly labeled synthetic dataset ONLY when --demo is explicitly requested
    for offline testing. Never marked as official or live data.
    """
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    records: list[dict[str, Any]] = []

    for mun in municipalities:
        # Deterministic spatial gradient purely for offline visual testing
        digest = int(hashlib.sha256(mun["municipalityId"].encode("utf-8")).hexdigest()[:6], 16)
        jitter = ((digest % 200) - 100) / 100.0
        base = 21.0 + (-25.0 - mun["latitude"]) * 1.8 + (-51.0 - mun["longitude"]) * 1.1 + jitter
        current_temp = round(base, 1)
        min_temp = round(base - 4.5, 1)
        max_temp = round(base + 5.8, 1)

        records.append(
            {
                "municipalityId": mun["municipalityId"],
                "municipalityName": mun["municipalityName"],
                "currentTemperature": current_temp,
                "maximumTemperature": max_temp,
                "minimumTemperature": min_temp,
                "updatedAt": now_iso,
            }
        )

    return records, now_iso


def count_available_municipalities(records: list[dict[str, Any]]) -> int:
    """Count municipalities having at least one valid temperature variable."""
    return sum(
        1
        for item in records
        if item.get("currentTemperature") is not None
        or item.get("maximumTemperature") is not None
        or item.get("minimumTemperature") is not None
    )


def write_dataset_safely(output_path: Path, dataset: dict[str, Any]) -> None:
    """Write JSON atomically so interrupted writes never corrupt the existing file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = output_path.with_suffix(".json.tmp")
    temp_path.write_text(
        json.dumps(dataset, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temp_path.replace(output_path)


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    repo_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(
        description="Collect meteorological temperatures for Paraná's 399 municipalities."
    )
    parser.add_argument(
        "--geojson",
        type=Path,
        default=repo_root / "public" / "data" / "municipalities.geojson",
        help="Path to reference municipalities.geojson",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repo_root / "public" / "data" / "temperatures.json",
        help="Destination path for temperatures.json",
    )
    parser.add_argument(
        "--min-valid",
        type=int,
        default=350,
        help="Minimum number of municipalities with valid data required to overwrite output",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Explicitly generate synthetic demonstration data (marked isDemo=true)",
    )
    parser.add_argument(
        "--allow-demo-fallback",
        action="store_true",
        help="If live collection fails AND no valid output file exists yet, write explicit demo data",
    )
    args = parser.parse_args()

    try:
        municipalities = load_municipalities_reference(args.geojson)
    except Exception as exc:  # noqa: BLE001
        LOGGER.error("Cannot load reference municipalities GeoJSON: %s", exc)
        return 1

    collected_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    if args.demo:
        LOGGER.warning("Generating EXPLICIT DEMO dataset (--demo flag enabled).")
        records, updated_at = generate_explicit_demo_dataset(municipalities)
        dataset = {
            "metadata": {
                "source": "Conjunto de Demonstração Fictício (Modo Offline Pinhal)",
                "sourceUrl": "https://github.com/andreysilveira/pinhal",
                "attribution": "Dados sintéticos gerados exclusivamente para demonstração técnica.",
                "collectedAt": collected_at,
                "updatedAt": updated_at,
                "totalMunicipalities": len(municipalities),
                "availableMunicipalities": count_available_municipalities(records),
                "status": "demo",
                "isDemo": True,
                "staleAfterHours": 6,
            },
            "municipalities": records,
        }
        write_dataset_safely(args.output, dataset)
        LOGGER.info("Wrote explicit demo dataset to %s", args.output)
        return 0

    try:
        records, updated_at = collect_open_meteo(municipalities)
        available = count_available_municipalities(records)
        if available < args.min_valid:
            raise RuntimeError(
                f"Validation failed: only {available}/{len(municipalities)} municipalities returned valid temperatures "
                f"(minimum threshold: {args.min_valid})."
            )

        status = "complete" if available == len(municipalities) else "partial"
        dataset = {
            "metadata": {
                "source": "Open-Meteo Weather Forecast API",
                "sourceUrl": "https://open-meteo.com/",
                "attribution": "Weather data by Open-Meteo.com (CC BY 4.0)",
                "collectedAt": collected_at,
                "updatedAt": updated_at,
                "totalMunicipalities": len(municipalities),
                "availableMunicipalities": available,
                "status": status,
                "isDemo": False,
                "staleAfterHours": 6,
            },
            "municipalities": records,
        }
        write_dataset_safely(args.output, dataset)
        LOGGER.info(
            "Successfully updated %s (%d/%d municipalities, status=%s)",
            args.output,
            available,
            len(municipalities),
            status,
        )
        return 0

    except Exception as exc:  # noqa: BLE001
        LOGGER.error("Live weather collection failed: %s", exc)
        if args.output.exists():
            LOGGER.info(
                "Preserving last valid dataset at %s without modification.",
                args.output,
            )
            return 1

        if args.allow_demo_fallback:
            LOGGER.warning(
                "No existing dataset found and --allow-demo-fallback is set. Writing EXPLICIT demo dataset."
            )
            records, updated_at = generate_explicit_demo_dataset(municipalities)
            dataset = {
                "metadata": {
                    "source": "Conjunto de Demonstração Fictício (Fallback Offline)",
                    "sourceUrl": "https://github.com/andreysilveira/pinhal",
                    "attribution": "Dados sintéticos de fallback claramente identificados como fictícios.",
                    "collectedAt": collected_at,
                    "updatedAt": updated_at,
                    "totalMunicipalities": len(municipalities),
                    "availableMunicipalities": count_available_municipalities(records),
                    "status": "demo",
                    "isDemo": True,
                    "staleAfterHours": 6,
                },
                "municipalities": records,
            }
            write_dataset_safely(args.output, dataset)
            return 0

        return 1


if __name__ == "__main__":
    sys.exit(main())
