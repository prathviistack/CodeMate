// Builds a nested folder tree from flat repository-relative file paths.
export function buildTree(files) {
  const root = { name: "", path: "", type: "dir", children: [] };
  const dirs = new Map([["", root]]);

  for (const file of files) {
    const parts = file.path.split("/");
    let parent = root;
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i];
      let dir = dirs.get(acc);
      if (!dir) {
        dir = { name: parts[i], path: acc, type: "dir", children: [] };
        dirs.set(acc, dir);
        parent.children.push(dir);
      }
      parent = dir;
    }
    parent.children.push({ name: parts[parts.length - 1], path: file.path, type: "file", file });
  }

  const sortNode = (node) => {
    node.children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
    node.children.forEach((c) => c.type === "dir" && sortNode(c));
  };
  sortNode(root);
  return root;
}

export const ancestorsOf = (path) => {
  const parts = path.split("/").slice(0, -1);
  return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
};
