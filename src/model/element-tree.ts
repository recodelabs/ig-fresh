export interface ElementNode {
  path: string;
  id: string;
  sliceName?: string;
  /** display label: last path segment, or the slice name for slices */
  label: string;
  min: number;
  max: string;
  short?: string;
  definition?: string;
  types: { code: string; profiles?: string[]; targetProfiles?: string[] }[];
  mustSupport: boolean;
  isModifier: boolean;
  isSummary: boolean;
  binding?: { strength: string; valueSet?: string };
  /** rendered fixed/pattern value, if any */
  fixed?: string;
  inDifferential: boolean;
  children: ElementNode[];
}

function renderFixed(el: any): string | undefined {
  for (const key of Object.keys(el)) {
    if (/^(fixed|pattern)[A-Z]/.test(key)) {
      const v = el[key];
      if (typeof v === "object") {
        // CodeableConcept / Coding: show system|code compactly
        const coding = v.coding?.[0] ?? (v.code ? v : undefined);
        if (coding?.code) return coding.system ? `${coding.system}#${coding.code}` : coding.code;
        return JSON.stringify(v);
      }
      return String(v);
    }
  }
  return undefined;
}

function toNode(el: any, inDifferential: boolean): ElementNode {
  const segments = String(el.path ?? "").split(".");
  return {
    path: el.path ?? "",
    id: el.id ?? el.path ?? "",
    sliceName: el.sliceName,
    label: el.sliceName ?? segments[segments.length - 1] ?? "",
    min: el.min ?? 0,
    max: el.max ?? "",
    short: el.short,
    definition: el.definition,
    types: (el.type ?? []).map((t: any) => ({
      code: t.code,
      profiles: t.profile,
      targetProfiles: t.targetProfile,
    })),
    mustSupport: el.mustSupport === true,
    isModifier: el.isModifier === true,
    isSummary: el.isSummary === true,
    binding: el.binding
      ? { strength: el.binding.strength, valueSet: el.binding.valueSet }
      : undefined,
    fixed: renderFixed(el),
    inDifferential,
    children: [],
  };
}

/**
 * Build a nested element tree from a StructureDefinition.
 * Uses element `id`s (which carry slice names, e.g. "Task.input:reason.value[x]")
 * so slices nest under their sliced element and slice children under the slice.
 */
export function buildElementTree(sd: any): { root: ElementNode; differentialIds: Set<string> } {
  const differentialIds = new Set<string>(
    (sd.differential?.element ?? []).map((e: any) => String(e.id ?? e.path)),
  );
  const elements: any[] = sd.snapshot?.element ?? sd.differential?.element ?? [];
  if (!elements.length) {
    return {
      root: toNode({ id: sd.type ?? sd.id, path: sd.type ?? sd.id, min: 0, max: "*" }, false),
      differentialIds,
    };
  }

  const usingSnapshot = Boolean(sd.snapshot?.element?.length);
  const root = toNode(elements[0], !usingSnapshot || differentialIds.has(elements[0].id ?? elements[0].path));
  // stack of (idPrefix, node) from root to current deepest
  const stack: { id: string; node: ElementNode }[] = [{ id: root.id, node: root }];

  for (const el of elements.slice(1)) {
    const id: string = el.id ?? el.path;
    const node = toNode(el, !usingSnapshot || differentialIds.has(id));
    // pop until top of stack is a prefix of this id ("<parent>." or "<parent>:")
    while (
      stack.length > 1 &&
      !(id.startsWith(stack[stack.length - 1].id + ".") || id.startsWith(stack[stack.length - 1].id + ":"))
    ) {
      stack.pop();
    }
    stack[stack.length - 1].node.children.push(node);
    stack.push({ id, node });
  }
  return { root, differentialIds };
}

/** Depth-first flatten with depth annotation, for table-style rendering. */
export function flattenTree(root: ElementNode): { node: ElementNode; depth: number }[] {
  const out: { node: ElementNode; depth: number }[] = [];
  const walk = (n: ElementNode, depth: number) => {
    out.push({ node: n, depth });
    for (const c of n.children) walk(c, depth + 1);
  };
  walk(root, 0);
  return out;
}
