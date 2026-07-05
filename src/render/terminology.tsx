import type { VNode } from "preact";
import type { Artifact } from "../model/types.js";
import { Card, CopyButton, KindBadge, MetaGrid, StatusPill, TagBadges } from "./components.js";
import type { RenderCtx } from "./structure-definition.js";

function Header({ a }: { a: Artifact }) {
  return (
    <>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px">
        <KindBadge kind={a.kind} />
        <StatusPill status={a.status} version={a.version} />
        <TagBadges tags={a.tags} />
      </div>
      <h1 style="margin-top:10px">{a.json.title ?? a.json.name ?? a.id}</h1>
      {a.description ? <p class="page-lede">{a.description}</p> : null}
      <Card>
        <MetaGrid
          rows={[
            {
              label: "Canonical",
              value: (
                <span class="font-mono" style="display:inline-flex;gap:8px;align-items:center">
                  {a.url} <CopyButton text={a.url ?? ""} label="Copy canonical URL" />
                </span>
              ),
            },
            { label: "Content", value: a.json.content },
            { label: "Case sensitive", value: a.json.caseSensitive === undefined ? undefined : String(a.json.caseSensitive) },
            { label: "Experimental", value: a.json.experimental === undefined ? undefined : String(a.json.experimental) },
          ]}
        />
      </Card>
    </>
  );
}

function ConceptTable({
  id,
  concepts,
  showSystem,
}: {
  id: string;
  concepts: { code: string; display?: string; definition?: string; system?: string }[];
  showSystem?: boolean;
}) {
  return (
    <>
      <input
        class="filter-input font-mono"
        type="search"
        placeholder={`Filter ${concepts.length} concepts…`}
        data-filter={id}
        aria-label="Filter concepts"
      />
      <span style="font-size:12px;color:var(--ink-faint)">
        <span data-filter-count={id}>{concepts.length}</span> shown
      </span>
      <div id={id} style="overflow-x:auto;margin-top:8px">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Display</th>
              {showSystem ? <th>System</th> : <th>Definition</th>}
            </tr>
          </thead>
          <tbody>
            {concepts.map((c) => (
              <tr
                data-filter-text={`${c.code} ${c.display ?? ""} ${c.definition ?? ""}`.toLowerCase()}
              >
                <td>
                  <span class="code-chip">{c.code}</span>
                </td>
                <td>{c.display}</td>
                {showSystem ? (
                  <td class="font-mono" style="font-size:11.5px;color:var(--ink-faint)">{c.system}</td>
                ) : (
                  <td style="color:var(--ink-muted)">{c.definition}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function renderCodeSystem(a: Artifact, _ctx: RenderCtx): VNode {
  const flatten = (cs: any[]): any[] =>
    cs.flatMap((c) => [c, ...(c.concept ? flatten(c.concept) : [])]);
  const concepts = flatten(a.json.concept ?? []);
  return (
    <article>
      <Header a={a} />
      <Card title={`Concepts (${concepts.length})`}>
        <ConceptTable id={`concepts-${a.id}`} concepts={concepts} />
      </Card>
    </article>
  );
}

export function renderValueSet(a: Artifact, ctx: RenderCtx): VNode {
  const expansion = a.url ? ctx.expansions.get(a.url) : undefined;
  const includes: any[] = a.json.compose?.include ?? [];
  return (
    <article>
      <Header a={a} />
      {expansion?.length ? (
        <Card title={`Expansion (${expansion.length} concepts)`}>
          <ConceptTable id={`expansion-${a.id}`} concepts={expansion} showSystem />
        </Card>
      ) : null}
      {includes.length ? (
        <Card title="Content logical definition">
          <ul style="margin:0;padding-left:1.2em">
            {includes.map((inc) => {
              const sysHref = inc.system ? ctx.links.hrefFor(inc.system) : undefined;
              return (
                <li style="margin:4px 0">
                  {inc.concept?.length ? (
                    <>
                      {inc.concept.length} concept{inc.concept.length > 1 ? "s" : ""} from{" "}
                    </>
                  ) : (
                    <>All codes from </>
                  )}
                  {sysHref ? (
                    <a href={sysHref} class="font-mono" style="font-size:12.5px">{inc.system}</a>
                  ) : (
                    <span class="font-mono" style="font-size:12.5px">{inc.system}</span>
                  )}
                  {inc.valueSet ? (
                    <span class="font-mono" style="font-size:12.5px">{(inc.valueSet ?? []).join(", ")}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </article>
  );
}
