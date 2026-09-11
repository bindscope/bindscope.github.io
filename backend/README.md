# BindScope analysis service

This service wraps PLIP in a small FastAPI endpoint for protein–ligand complexes.

## Endpoints

- `GET /health`
- `POST /analyze` with one PDB or ENT file in the `file` form field

Uploads are capped at 15 MB, processed in a temporary directory, and removed when the request finishes. One analysis runs at a time and each job has a two-minute limit.

## Local Docker run

```bash
docker build -t bindscope-analysis ./backend
docker run --rm -p 10000:10000 bindscope-analysis
```

Set `NEXT_PUBLIC_BINDSCOPE_API_URL` to the deployed service origin when building the frontend.
