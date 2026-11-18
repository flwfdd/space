import type { CollectionEntry } from "astro:content";

export type NoteEntry = CollectionEntry<"notes">;

export type NoteNode =
  | { type: "file"; name: string; title: string; note: NoteEntry }
  | { type: "folder"; name: string; children: NoteTree };

export type NoteTree = Record<string, NoteNode>;

export function buildNoteTree(notes: NoteEntry[]): NoteTree {
  const root: NoteTree = {};

  for (const note of notes) {
    const parts = note.id.split("/");
    let current = root;

    for (const [index, name] of parts.entries()) {
      const isFile = index === parts.length - 1;
      const existing = current[name];

      if (isFile) {
        if (existing) {
          throw new Error(`笔记路径与目录冲突：${note.id}`);
        }
        current[name] = {
          type: "file",
          name,
          title: note.data.title || name,
          note,
        };
        continue;
      }

      if (existing?.type === "file") {
        throw new Error(`笔记路径与目录冲突：${note.id}`);
      }

      const folder = existing ?? { type: "folder" as const, name, children: {} };
      current[name] = folder;
      current = folder.children;
    }
  }

  return root;
}

export function sortedNoteNodes(tree: NoteTree): NoteNode[] {
  return Object.values(tree).sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
