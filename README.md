# BindScope

BindScope is an interactive structural analysis workspace for protein and ligand structures.

The public application is designed for `https://bindscope.github.io`.

## Current alpha

- Fetch a structure from the RCSB Protein Data Bank by identifier
- Upload PDB, mmCIF, SDF, MOL2, MOL, or PDBQT files for visualization
- Rotate, zoom, and inspect structures with cartoon, surface, and stick representations
- Detect non-solvent ligands in PDB files
- Screen protein atoms within 4.0 Å of a bound ligand
- Flag candidate polar atom pairs within 3.5 Å
- Keep uploaded structure data in the active browser session

The contact screen is a transparent geometric analysis. It is not a replacement for protonation-aware interaction profiling or experimentally supported binding-mode assessment.

## Planned scientific engines

- Structure validation and preparation
- PLIP-style interaction profiling
- Protein pocket detection using consensus methods
- Separate receptor and ligand preparation
- Docking with multiple pose retention
- Two-dimensional interaction diagrams
- Reproducible methods and result exports

## Development

Install dependencies and run the development server with the package scripts declared in `package.json`.

## License

The project is currently private and no reuse license has been assigned.
