// Converts a Jupyter notebook to readable text: cell sources only. Outputs (which can be
// megabytes of base64 images) are dropped. Returns null if the file is not a valid notebook.

const joinSource = (src) => (Array.isArray(src) ? src.join("") : typeof src === "string" ? src : "");

export function notebookToText(raw) {
  let nb;
  try {
    nb = JSON.parse(raw);
  } catch {
    return null;
  }
  const cells = Array.isArray(nb?.cells) ? nb.cells : Array.isArray(nb?.worksheets?.[0]?.cells) ? nb.worksheets[0].cells : null;
  if (!cells) return null;

  const parts = [];
  for (const cell of cells) {
    const type = cell?.cell_type === "markdown" ? "markdown" : cell?.cell_type === "code" ? "code" : null;
    if (!type) continue;
    const src = joinSource(cell.source ?? cell.input).replace(/\r\n?/g, "\n").replace(/\n+$/, "");
    const body = type === "markdown" ? src.split("\n").map((l) => `# ${l}`.trimEnd()).join("\n") : src;
    parts.push(`# %% [${type}]\n${body}`);
  }
  return parts.join("\n\n") + "\n";
}
