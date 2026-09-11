import asyncio
import os
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_SUFFIXES = {".pdb", ".ent"}
PLIP_TAGS = {
    "hydrophobic_interactions": "hydrophobic",
    "hydrogen_bonds": "hydrogen_bonds",
    "water_bridges": "water_bridges",
    "salt_bridges": "salt_bridges",
    "pi_stacks": "pi_stacking",
    "pi_cation_interactions": "pi_cation",
    "halogen_bonds": "halogen_bonds",
    "metal_complexes": "metal_complexes",
}

app = FastAPI(title="BindScope PLIP API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://bindscope.github.io",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
analysis_slot = asyncio.Semaphore(1)


def _text_map(element: ET.Element) -> dict[str, str]:
    values: dict[str, str] = {}
    for child in element.iter():
        if child is element or list(child):
            continue
        value = (child.text or "").strip()
        if value:
            values[child.tag.split("}")[-1]] = value
    return values


def _parse_report(report_path: Path) -> dict:
    root = ET.parse(report_path).getroot()
    sites = []
    totals = {label: 0 for label in PLIP_TAGS.values()}
    for site in root.findall(".//bindingsite"):
        site_data = {
            "id": site.get("id", "unknown"),
            "ligand": _text_map(site.find("identifiers") or site),
            "interactions": {},
        }
        interactions = site.find("interactions")
        if interactions is not None:
            for xml_tag, label in PLIP_TAGS.items():
                container = interactions.find(xml_tag)
                records = [] if container is None else [_text_map(item) for item in list(container)]
                site_data["interactions"][label] = records
                totals[label] += len(records)
        sites.append(site_data)
    return {"engine": "PLIP", "sites": sites, "totals": totals}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "PLIP"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)) -> dict:
    suffix = Path(file.filename or "structure.pdb").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(415, "Full interaction analysis currently accepts PDB or ENT complexes")
    payload = await file.read(MAX_UPLOAD_BYTES + 1)
    if not payload or len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Structure must be between 1 byte and 15 MB")
    if not any(line.startswith((b"ATOM  ", b"HETATM")) for line in payload.splitlines()[:5000]):
        raise HTTPException(422, "The upload does not look like a PDB structure")

    async with analysis_slot:
        with tempfile.TemporaryDirectory(prefix="bindscope-") as temp_dir:
            workdir = Path(temp_dir)
            input_path = workdir / "complex.pdb"
            input_path.write_bytes(payload)
            command = [
                "/usr/bin/python3", "/src/plip/plipcmd.py",
                "-f", str(input_path), "-x", "-o", str(workdir),
            ]
            try:
                await asyncio.to_thread(
                    subprocess.run,
                    command,
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=120,
                )
            except subprocess.TimeoutExpired as exc:
                raise HTTPException(504, "PLIP analysis exceeded the two-minute limit") from exc
            except subprocess.CalledProcessError as exc:
                detail = (exc.stderr or exc.stdout or "PLIP could not analyze this complex")[-1200:]
                raise HTTPException(422, detail) from exc

            reports = sorted(workdir.glob("*.xml"))
            if not reports:
                raise HTTPException(500, "PLIP did not produce an XML report")
            return _parse_report(reports[0])
