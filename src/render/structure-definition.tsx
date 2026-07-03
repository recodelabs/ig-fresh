import type { VNode } from "preact";
import type { Artifact, IgModel } from "../model/types.js";
import { buildElementTree, flattenTree, type ElementNode } from "../model/element-tree.js";
import { Card, CopyButton, FlagBadge, KindBadge, MetaGrid, StatusPill } from "./components.js";
import type { LinkResolver } from "./links.js";

export interface RenderCtx {
  model: IgModel;
  links: LinkResolver;
  expansions: Map<string, { system: string; code: string; display?: string }[]>;
  /** shiki-highlighted JSON html (pre-rendered by the build), if available */
  jsonHtml?: string;
  /** examples in the IG that claim conformance to this profile */
  examplesOf: Artifact[];
}

function TypeCell({ node, links }: { node: ElementNode; links: LinkResolver }) {
  if (!node.types.length) return <span class="tree-type" />;
  return (
    <span class="tree-type" title={node.types.map((t) => t.code).join(" | ")}>
      {node.types.map((t, i) => {
        const targets = t.targetProfiles ?? t.profiles;
        const href = t.profiles?.length ? links.hrefFor(t.profiles[0]) : links.hrefForType(t.code);
        return (
          <>
            {i > 0 ? <span class="opacity-50"> | </span> : null}
            {href ? <a href={href}>{t.code}</a> : t.code}
            {t.code === "Reference" && targets?.length ? (
              <span class="opacity-70">
                (
                {targets.map((p, j) => {
                  const name = p.split("/").pop();
                  const h = links.hrefFor(p);
                  return (
                    <>
                      {j > 0 ? " | " : ""}
                      {h ? <a href={h}>{name}</a> : name}
                    </>
                  );
                })}
                )
              </span>
            ) : null}
          </>
        );
      })}
    </span>
  );
}

function TreeRows({ root, links }: { root: ElementNode; links: LinkResolver }) {
  const flat = flattenTree(root);
  // ancestors per row for JS collapse; mark diff rows and diff-ancestors
  const rows: VNode[] = [];
  const path: ElementNode[] = [];
  const hasDiffDesc = new Map<string, boolean>();
  const computeDiff = (n: ElementNode): boolean => {
    let any = n.inDifferential;
    for (const c of n.children) any = computeDiff(c) || any;
    hasDiffDesc.set(n.id, any);
    return any;
  };
  computeDiff(root);

  const walk = (n: ElementNode, depth: number, ancestors: string[]) => {
    const isRoot = depth === 0;
    rows.push(
      <div
        class={`tree-row ${n.mustSupport ? "is-ms" : ""}`}
        data-ancestors={ancestors.join("|")}
        data-diff={n.inDifferential || (hasDiffDesc.get(n.id) && n.children.length) ? "" : undefined}
      >
        <span class="tree-name" style={`padding-left:${depth * 18}px`}>
          {n.children.length ? (
            <button
              type="button"
              class="tree-toggle"
              data-node-toggle={n.id}
              aria-expanded="true"
              aria-label={`Collapse ${n.label}`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          ) : (
            <span class="tree-toggle" aria-hidden="true" />
          )}
          <span class={n.sliceName ? "tree-slice" : isRoot ? "font-semibold" : ""} title={n.path}>
            {n.label}
          </span>
        </span>
        <span class="tree-flags">
          {n.mustSupport ? <FlagBadge flag="ms" title="Must Support" /> : null}
          {n.isModifier ? <FlagBadge flag="mod" title="Modifier element" /> : null}
          {n.isSummary ? <FlagBadge flag="sum" title="Included in summaries" /> : null}
        </span>
        <span class="tree-card">{isRoot ? "" : `${n.min}..${n.max}`}</span>
        <TypeCell node={n} links={links} />
        <span class="tree-desc" title={n.short ?? n.definition ?? ""}>
          {n.fixed ? <span class="tree-fixed">= {n.fixed} </span> : null}
          {n.binding ? (
            <>
              <a href={links.hrefFor(n.binding.valueSet ?? "") ?? "#"} class="font-mono" style="font-size:11px">
                {(n.binding.valueSet ?? "").split("/").pop()?.split("|")[0]}
              </a>{" "}
              <span class="opacity-60">({n.binding.strength})</span>{" "}
            </>
          ) : null}
          {n.short}
        </span>
      </div>,
    );
    for (const c of n.children) walk(c, depth + 1, [...ancestors, n.id]);
  };
  walk(root, 0, []);
  return <>{rows}</>;
}

export function renderStructureDefinition(a: Artifact, ctx: RenderCtx): VNode {
  const sd = a.json;
  const { root } = buildElementTree(sd);
  const flat = flattenTree(root);
  const keyElements = flat.filter(
    (f) => f.depth > 0 && (f.node.mustSupport || (f.node.min > 0 && f.node.inDifferential)),
  );
  const treeId = `tree-${a.id}`;
  const baseName = sd.baseDefinition?.split("/").pop();
  const baseHref = sd.baseDefinition ? ctx.links.hrefFor(sd.baseDefinition) : undefined;

  return (
    <article>
      <div class="flex flex-wrap items-center gap-3" style="display:flex;flex-wrap:wrap;align-items:center;gap:10px">
        <KindBadge kind={a.kind} />
        <StatusPill status={a.status} version={a.version} />
      </div>
      <h1 style="margin-top:10px">{sd.title ?? sd.name ?? a.id}</h1>
      {a.description ? <p class="page-lede">{a.description}</p> : null}

      <Card>
        <MetaGrid
          rows={[
            {
              label: "Canonical",
              value: (
                <span class="font-mono" style="display:inline-flex;gap:8px;align-items:center">
                  {sd.url} <CopyButton text={sd.url} label="Copy canonical URL" />
                </span>
              ),
            },
            {
              label: "Base definition",
              value: baseName ? (baseHref ? <a href={baseHref}>{baseName}</a> : baseName) : undefined,
            },
            { label: "Type", value: <span class="font-mono">{sd.type}</span> },
            { label: "Derivation", value: sd.derivation },
            { label: "Maturity", value: sd.fhirVersion ? `FHIR ${sd.fhirVersion}` : undefined },
          ]}
        />
      </Card>

      {keyElements.length ? (
        <Card title="Key elements">
          <p style="margin:0 0 10px;font-size:12.5px;color:var(--ink-muted)">
            Required and must-support elements this {a.kind === "extension" ? "extension" : "profile"} constrains.
          </p>
          <div class="data-table-wrap" style="overflow-x:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Element</th>
                  <th>Card.</th>
                  <th>Flags</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {keyElements.slice(0, 24).map((f) => (
                  <tr>
                    <td>
                      <span class="code-chip">{f.node.path.replace(/^[^.]+\./, "")}</span>
                    </td>
                    <td class="font-mono" style="font-size:12px">{`${f.node.min}..${f.node.max}`}</td>
                    <td>
                      <span class="tree-flags">
                        {f.node.mustSupport ? <FlagBadge flag="ms" title="Must Support" /> : null}
                        {f.node.isModifier ? <FlagBadge flag="mod" title="Modifier" /> : null}
                      </span>
                    </td>
                    <td style="color:var(--ink-muted)">{f.node.short}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card title="Structure">
        <div class="tab-list" role="tablist" style="margin-bottom:12px">
          <button type="button" class="tab-btn" role="tab" data-tree-view={treeId} data-view="diff" aria-selected="true">
            Differential
          </button>
          <button type="button" class="tab-btn" role="tab" data-tree-view={treeId} data-view="all" aria-selected="false">
            Snapshot
          </button>
        </div>
        <div class="tree" id={treeId} data-tree data-view="diff">
          <div class="tree-head">
            <span>Name</span>
            <span>Flags</span>
            <span>Card.</span>
            <span>Type</span>
            <span>Description &amp; constraints</span>
          </div>
          <TreeRows root={root} links={ctx.links} />
        </div>
      </Card>

      {ctx.examplesOf.length ? (
        <Card title={`Examples (${ctx.examplesOf.length})`}>
          <ul style="margin:0;padding-left:1.2em">
            {ctx.examplesOf.map((e) => (
              <li>
                <a href={e.filename}>{e.title}</a>
                {e.description ? <span style="color:var(--ink-muted)"> — {e.description}</span> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {ctx.jsonHtml ? (
        <Card title="JSON definition">
          <div class="json-view" dangerouslySetInnerHTML={{ __html: ctx.jsonHtml }} />
          <p style="margin:10px 0 0;font-size:12px;color:var(--ink-faint)">
            Raw renditions: <a href={`${a.resourceType}-${a.id}.json`}>JSON</a> ·{" "}
            <a href={`${a.resourceType}-${a.id}.xml`}>XML</a> ·{" "}
            <a href={`${a.resourceType}-${a.id}.ttl`}>Turtle</a>
          </p>
        </Card>
      ) : null}
    </article>
  );
}
