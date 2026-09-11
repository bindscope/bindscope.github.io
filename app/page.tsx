"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Atom, ChevronDown, CircleHelp, Download, FileBox, FlaskConical, Focus, Layers3, Menu, MousePointer2, Play, RotateCcw, Search, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment";

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

type AtomRecord = { record: string; resn: string; chain: string; resi: string; x: number; y: number; z: number; element: string };
type Analysis = { atoms: number; residues: number; chains: number; ligands: string[]; contacts: number; polarContacts: number; contactResidues: string[] };
const EXCLUDED = new Set(["HOH", "WAT", "DOD", "NA", "CL", "K", "CA", "MG", "MN", "ZN", "SO4", "PO4", "GOL", "EDO"]);

function parsePdb(text: string): AtomRecord[] {
  return text.split(/\r?\n/).flatMap((line) => {
    const record = line.slice(0, 6).trim();
    if (record !== "ATOM" && record !== "HETATM") return [];
    const x = Number(line.slice(30, 38)), y = Number(line.slice(38, 46)), z = Number(line.slice(46, 54));
    if (![x, y, z].every(Number.isFinite)) return [];
    return [{ record, resn: line.slice(17, 20).trim(), chain: line.slice(21, 22).trim() || "_", resi: line.slice(22, 26).trim(), x, y, z, element: line.slice(76, 78).trim() || line.slice(12, 14).trim().replace(/\d/g, "").slice(0, 1) }];
  });
}

function analyzePdb(text: string): Analysis {
  const atoms = parsePdb(text);
  const protein = atoms.filter((a) => a.record === "ATOM");
  const ligand = atoms.filter((a) => a.record === "HETATM" && !EXCLUDED.has(a.resn));
  const residues = new Set(protein.map((a) => `${a.chain}.${a.resn}${a.resi}`));
  const chains = new Set(protein.map((a) => a.chain));
  const contactResidues = new Set<string>();
  let contacts = 0, polarContacts = 0;
  for (const p of protein) for (const l of ligand) {
    const d2 = (p.x-l.x)**2 + (p.y-l.y)**2 + (p.z-l.z)**2;
    if (d2 <= 16) { contacts += 1; contactResidues.add(`${p.chain}.${p.resn}${p.resi}`); }
    if (d2 <= 12.25 && ["N","O","S"].includes(p.element.toUpperCase()) && ["N","O","S"].includes(l.element.toUpperCase())) polarContacts += 1;
  }
  return { atoms: atoms.length, residues: residues.size, chains: chains.size, ligands: [...new Set(ligand.map((a) => a.resn))], contacts, polarContacts, contactResidues: [...contactResidues].slice(0, 24) };
}

const emptyAnalysis: Analysis = { atoms: 0, residues: 0, chains: 0, ligands: [], contacts: 0, polarContacts: 0, contactResidues: [] };

export default function Home() {
  const viewerEl = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState("complex");
  const [structureName, setStructureName] = useState("1HVR · HIV-1 protease");
  const [fileName, setFileName] = useState("1HVR.pdb");
  const [analysis, setAnalysis] = useState<Analysis>(emptyAnalysis);
  const [loading, setLoading] = useState(true);
  const [representation, setRepresentation] = useState("cartoon");
  const [pdbId, setPdbId] = useState("1HVR");
  const [error, setError] = useState("");

  const renderStructure = useCallback(async (data: string, format = "pdb") => {
    if (!viewerEl.current) return;
    const $3Dmol = await import("3dmol");
    if (!viewerRef.current) viewerRef.current = $3Dmol.createViewer(viewerEl.current, { backgroundColor: "#07111f", antialias: true });
    const viewer = viewerRef.current;
    viewer.removeAllModels(); viewer.removeAllSurfaces(); viewer.addModel(data, format);
    viewer.setStyle({ hetflag: false }, { cartoon: { color: "spectrum", opacity: 0.92 } });
    viewer.setStyle({ hetflag: true }, { stick: { colorscheme: "greenCarbon", radius: 0.19 }, sphere: { scale: 0.25 } });
    viewer.zoomTo(); viewer.render();
  }, []);

  const loadPdb = useCallback(async (id: string) => {
    const cleanId = id.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(cleanId)) { setError("Enter a four-character PDB identifier"); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`https://files.rcsb.org/download/${cleanId}.pdb`);
      if (!response.ok) throw new Error();
      const data = await response.text();
      await renderStructure(data, "pdb"); setAnalysis(analyzePdb(data));
      setStructureName(`${cleanId} · RCSB structure`); setFileName(`${cleanId}.pdb`); setPdbId(cleanId);
    } catch { setError("The structure could not be loaded. Check the identifier or upload a file."); }
    finally { setLoading(false); }
  }, [renderStructure]);

  useEffect(() => { loadPdb("1HVR"); }, [loadPdb]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "load_pdb_structure",
      title: "Load PDB structure",
      description: "Load an RCSB PDB structure into the visible BindScope workspace and run the browser-side contact screen.",
      inputSchema: { type: "object", properties: { pdbId: { type: "string", pattern: "^[A-Za-z0-9]{4}$" } }, required: ["pdbId"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input: unknown) {
        const value = input as { pdbId?: string };
        if (!value.pdbId || !/^[A-Za-z0-9]{4}$/.test(value.pdbId)) throw new Error("A valid four-character PDB identifier is required");
        await loadPdb(value.pdbId);
        return { pdbId: value.pdbId.toUpperCase(), status: "loaded" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [loadPdb]);
  useEffect(() => {
    const viewer = viewerRef.current; if (!viewer) return;
    viewer.removeAllSurfaces(); viewer.setStyle({}, {});
    if (representation === "surface") { viewer.addSurface(1, { opacity: 0.84, colorscheme: "whiteCarbon" }, { hetflag: false }); viewer.setStyle({ hetflag: true }, { stick: { colorscheme: "greenCarbon", radius: 0.2 }, sphere: { scale: 0.25 } }); }
    else if (representation === "sticks") { viewer.setStyle({}, { stick: { colorscheme: "Jmol", radius: 0.12 } }); viewer.setStyle({ hetflag: true }, { stick: { colorscheme: "greenCarbon", radius: 0.22 }, sphere: { scale: 0.28 } }); }
    else { viewer.setStyle({ hetflag: false }, { cartoon: { color: "spectrum", opacity: 0.92 } }); viewer.setStyle({ hetflag: true }, { stick: { colorscheme: "greenCarbon", radius: 0.19 }, sphere: { scale: 0.25 } }); }
    viewer.render();
  }, [representation]);

  async function handleFile(file: File) {
    setError(""); setLoading(true);
    try {
      const text = await file.text(); const ext = file.name.split(".").pop()?.toLowerCase() || "pdb"; const format = ext === "mmcif" ? "cif" : ext;
      await renderStructure(text, format); setFileName(file.name); setStructureName(file.name.replace(/\.[^.]+$/, "")); setAnalysis(format === "pdb" || format === "ent" ? analyzePdb(text) : emptyAnalysis);
    } catch { setError("This file could not be interpreted as a molecular structure."); }
    finally { setLoading(false); }
  }

  const modeText = mode === "complex" ? "Inspect a protein with a bound ligand and screen its local contacts." : mode === "separate" ? "Load receptor and ligand files before selecting a docking site." : mode === "protein" ? "Inspect a protein structure and prepare it for pocket detection." : "Review a ligand structure and prepare it for three-dimensional analysis.";
  const ligandLabel = analysis.ligands.length ? analysis.ligands.join(", ") : "None detected";

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark" aria-hidden="true"><Atom /></div><span className="brand-name">BindScope</span><span className="alpha-badge">ALPHA</span></div>
      <nav className="topnav" aria-label="Primary navigation"><button className="nav-active">Workspace</button><button>Projects</button><button>Methods</button></nav>
      <div className="header-actions"><button className="icon-button" aria-label="Help"><CircleHelp /></button><Button className="new-analysis" onClick={() => fileRef.current?.click()}><Upload /> New analysis</Button><button className="mobile-menu" aria-label="Open menu"><Menu /></button></div>
    </header>

    <section className="workspace">
      <aside className="input-panel">
        <div className="panel-heading"><div><span className="eyebrow">INPUT</span><h1>Structure setup</h1></div><button className="icon-button" aria-label="Reset workspace" onClick={() => loadPdb("1HVR")}><RotateCcw /></button></div>
        <Tabs value={mode} onValueChange={setMode}><TabsList className="mode-tabs"><TabsTrigger value="complex">Complex</TabsTrigger><TabsTrigger value="separate">Separate</TabsTrigger><TabsTrigger value="protein">Protein</TabsTrigger><TabsTrigger value="ligand">Ligand</TabsTrigger></TabsList></Tabs>
        <div className="mode-explainer"><FlaskConical /><p>{modeText}</p></div>
        <label className="field-label" htmlFor="pdb-search">Fetch from RCSB PDB</label>
        <div className="pdb-search"><Search /><input id="pdb-search" value={pdbId} onChange={(e) => setPdbId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadPdb(pdbId)} maxLength={12} aria-label="PDB identifier" /><Button size="sm" onClick={() => loadPdb(pdbId)}>Load</Button></div>
        <div className="or-divider"><span>or upload</span></div>
        <button className="drop-zone" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleFile(file); }}><span className="upload-icon"><Upload /></span><strong>{mode === "separate" ? "Add receptor structure" : "Drop a molecular structure"}</strong><span>PDB, mmCIF, SDF, MOL2, MOL or PDBQT</span><small>Files are analyzed in this browser session</small></button>
        <input ref={fileRef} className="sr-only" type="file" accept=".pdb,.ent,.cif,.mmcif,.sdf,.mol2,.mol,.pdbqt" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
        <Attachment className="loaded-file" state={loading ? "processing" : "done"}><AttachmentMedia><FileBox /></AttachmentMedia><AttachmentContent><AttachmentTitle>{fileName}</AttachmentTitle><AttachmentDescription>{loading ? "Reading structure" : analysis.atoms ? `${analysis.atoms.toLocaleString()} atoms` : "Structure loaded"}</AttachmentDescription></AttachmentContent><AttachmentActions><AttachmentAction aria-label="Remove file"><X /></AttachmentAction></AttachmentActions></Attachment>
        {error && <p className="error-message">{error}</p>}
        <div className="privacy-note"><ShieldCheck /><span><strong>Private by default</strong> Uploaded structures remain limited to the current analysis session.</span></div>
      </aside>

      <section className="viewer-panel">
        <div className="viewer-toolbar"><div><span className="status-dot" /><strong>{structureName}</strong><span className="muted-label">Biological assembly</span></div><div className="viewer-actions"><button className="tool-button"><MousePointer2 /> Select</button><button className="tool-button" onClick={() => { viewerRef.current?.zoomTo({ hetflag: true }); viewerRef.current?.render(); }}><Focus /> Focus ligand</button><button className="tool-button"><Download /> Export</button></div></div>
        <div className="viewer-stage"><div ref={viewerEl} className="molecule-viewer" aria-label="Interactive molecular structure viewer" />{loading && <div className="viewer-loading"><Activity className="animate-spin" /> Loading structure</div>}<div className="representation-switcher" role="group" aria-label="Molecular representation">{[["cartoon","Cartoon"],["surface","Surface"],["sticks","Sticks"]].map(([value,label]) => <button key={value} className={representation === value ? "active" : ""} onClick={() => setRepresentation(value)}>{label}</button>)}</div><div className="viewer-hint">Drag to rotate · Scroll to zoom · Right-drag to move</div></div>
        <div className="structure-strip"><div><span>CHAINS</span><strong>{analysis.chains || "—"}</strong></div><div><span>RESIDUES</span><strong>{analysis.residues || "—"}</strong></div><div><span>ATOMS</span><strong>{analysis.atoms ? analysis.atoms.toLocaleString() : "—"}</strong></div><div><span>LIGAND</span><strong className="ligand-value">{ligandLabel}</strong></div></div>
      </section>

      <aside className="results-panel">
        <div className="panel-heading results-heading"><div><span className="eyebrow">RESULTS</span><h2>Interaction screen</h2></div><button className="icon-button" aria-label="More result options"><ChevronDown /></button></div>
        <div className="analysis-state"><span className="analysis-icon"><Sparkles /></span><div><strong>Geometry check complete</strong><span>Browser-side contact analysis</span></div></div>
        <div className="metric-grid"><div><span>Contact residues</span><strong>{analysis.contactResidues.length}</strong><small>within 4.0 Å</small></div><div><span>Close atom pairs</span><strong>{analysis.contacts}</strong><small>geometric</small></div><div><span>Polar candidates</span><strong>{analysis.polarContacts}</strong><small>N, O or S pairs</small></div><div><span>Ligands found</span><strong>{analysis.ligands.length}</strong><small>non-solvent</small></div></div>
        <div className="section-title"><span>Binding-site residues</span><button>View all</button></div>
        <div className="residue-list">{analysis.contactResidues.length ? analysis.contactResidues.slice(0,8).map((residue,i) => <button key={residue}><span className={`residue-swatch swatch-${i%4}`} />{residue}<small>{i<2 ? "polar" : "contact"}</small></button>) : <p className="empty-note">No bound ligand contacts were detected in this structure.</p>}</div>
        <div className="caution-card"><Layers3 /><div><strong>Interpret with structure context</strong><p>This rapid screen uses distance and element rules. Protonation, bond geometry, alternate states, metals and water networks require a full analysis engine.</p></div></div>
        <Button className="run-button" disabled={!analysis.ligands.length}><Play /> Run full interaction analysis</Button><p className="engine-note">The validated server analysis pipeline will be connected in the next development stage.</p>
      </aside>
    </section>
  </main>;
}
