#!/usr/bin/env python3
"""Warm the OpenFreeMap Positron/Dark styles into the Atlas palette."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "app" / "public" / "map"
OUT.mkdir(parents=True, exist_ok=True)

LIGHT = {
    "background": "#F3EDE2",
    "park": "#DDE4D0",
    "water": "#BFD3CE",
    "waterway": "#A9C4BD",
    "residential": "#EEE6D8",
    "wood": "#D5DFC7",
    "building": "#E9E0D1",
    "building_outline": "#DCD1BF",
    "path": "#E4D7C2",
    "minor": "#F7F1E6",
    "major_casing": "#DFD3C0",
    "major_inner": "#FCF7EE",
    "major_subtle": "#EADFCD",
    "motorway_casing": "#D8C9B3",
    "motorway_inner": "#F4E6D2",
    "motorway_subtle": "#E7D8C3",
    "rail": "#D8CCB9",
    "rail_dash": "#F7F1E6",
    "boundary": "#C7BAA5",
    "water_text": "#4E6B6A",
    "road_text": "#7A6F5E",
    "place_text": "#3C3B32",
    "halo": "#F3EDE2",
}

DARK = {
    "background": "#0E100C",
    "park": "#1A2416",
    "water": "#16231F",
    "waterway": "#1A2C27",
    "residential": "#14170F",
    "wood": "#182013",
    "building": "#191C15",
    "building_outline": "#23271D",
    "path": "#24271E",
    "minor": "#262920",
    "major_casing": "#2D3127",
    "major_inner": "#353A2E",
    "major_subtle": "#2A2E24",
    "motorway_casing": "#3A3527",
    "motorway_inner": "#5A4B31",
    "motorway_subtle": "#33372B",
    "rail": "#2A2E24",
    "rail_dash": "#0E100C",
    "boundary": "#3A3D30",
    "water_text": "#88A79E",
    "road_text": "#8B8474",
    "place_text": "#A59C89",
    "halo": "#0E100C",
}


def paint_set(layer, **props):
    layer.setdefault("paint", {}).update(props)


def recolour(style, c):
    for layer in style["layers"]:
        lid = layer["id"]
        typ = layer["type"]
        if lid == "background":
            paint_set(layer, **{"background-color": c["background"]})
        elif lid == "park":
            paint_set(layer, **{"fill-color": c["park"]})
        elif lid == "water":
            paint_set(layer, **{"fill-color": c["water"]})
        elif lid == "waterway" or lid.startswith("waterway_"):
            if typ == "line":
                paint_set(layer, **{"line-color": c["waterway"]})
        elif lid == "landuse_residential":
            paint_set(layer, **{"fill-color": c["residential"], "fill-opacity": 0.55})
        elif lid == "landcover_wood":
            paint_set(layer, **{"fill-color": c["wood"]})
        elif lid == "landuse_park":
            paint_set(layer, **{"fill-color": c["park"]})
        elif lid == "building":
            paint_set(layer, **{"fill-color": c["building"], "fill-outline-color": c["building_outline"]})
        elif lid == "road_area_pier":
            paint_set(layer, **{"fill-color": c["background"]})
        elif lid == "road_pier":
            paint_set(layer, **{"line-color": c["background"]})
        elif lid == "highway_path":
            paint_set(layer, **{"line-color": c["path"]})
        elif lid == "highway_minor":
            paint_set(layer, **{"line-color": c["minor"]})
        elif lid in {"highway_major_casing", "highway_motorway_casing", "highway_motorway_bridge_casing"}:
            paint_set(layer, **{"line-color": c["motorway_casing"] if "motorway" in lid else c["major_casing"]})
        elif lid == "highway_major_inner":
            paint_set(layer, **{"line-color": c["major_inner"]})
        elif lid == "highway_major_subtle":
            paint_set(layer, **{"line-color": c["major_subtle"]})
        elif lid in {"highway_motorway_inner", "highway_motorway_bridge_inner"}:
            paint_set(layer, **{"line-color": c["motorway_inner"]})
        elif lid == "highway_motorway_subtle":
            paint_set(layer, **{"line-color": c["motorway_subtle"]})
        elif lid.startswith("railway") and typ == "line":
            if "dash" in lid:
                paint_set(layer, **{"line-color": c["rail_dash"]})
            else:
                paint_set(layer, **{"line-color": c["rail"]})
        elif lid.startswith("boundary"):
            paint_set(layer, **{"line-color": c["boundary"]})
        elif lid in {"waterway_line_label", "water_name_point_label", "water_name_line_label"}:
            paint_set(layer, **{"text-color": c["water_text"], "text-halo-color": c["halo"]})
        elif lid in {"highway-name-path", "highway-name-minor", "highway-name-major", "highway_name_other", "highway_name_motorway"}:
            paint_set(layer, **{"text-color": c["road_text"], "text-halo-color": c["halo"]})
        elif lid == "airport":
            paint_set(layer, **{"text-color": c["road_text"], "text-halo-color": c["halo"]})
        elif lid.startswith("label_") or lid.startswith("place_"):
            paint_set(layer, **{"text-color": c["place_text"], "text-halo-color": c["halo"]})
    style["layers"] = [l for l in style["layers"] if l["id"] not in {"natural_earth"}]
    return style


def main():
    light = json.loads((RAW / "ofm_positron.json").read_text())
    dark = json.loads((RAW / "ofm_dark.json").read_text())
    light = recolour(light, LIGHT)
    dark = recolour(dark, DARK)
    (OUT / "light.json").write_text(json.dumps(light, separators=(",", ":")))
    (OUT / "dark.json").write_text(json.dumps(dark, separators=(",", ":")))
    print("wrote", OUT / "light.json", len(light["layers"]), "layers")
    print("wrote", OUT / "dark.json", len(dark["layers"]), "layers")


if __name__ == "__main__":
    main()
