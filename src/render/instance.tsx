import type { VNode } from "preact";
import type { Artifact } from "../model/types.js";
import { Card, CopyButton, KindBadge, MetaGrid, StatusPill, TagBadges } from "./components.js";
import type { RenderCtx } from "./structure-definition.js";

/** Example instances and any resource type we don't have a dedicated renderer for. */
export function renderInstance(a: Artifact, ctx: RenderCtx): VNode {
  const profiles = a.ref?.profiles ?? a.json.meta?.profile ?? [];
  return (
    <article>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px">
        <KindBadge kind={a.kind} />
        <span class="status-pill font-mono">{a.resourceType}</span>
        <StatusPill status={a.status} version={a.version} />
        <TagBadges tags={a.tags} />
      </div>
      <h1 style="margin-top:10px">{a.title}</h1>
      {a.description ? <p class="page-lede">{a.description}</p> : null}

      <Card>
        <MetaGrid
          rows={[
            { label: "Resource id", value: <span class="font-mono">{a.id}</span> },
            a.url
              ? {
                  label: "Canonical",
                  value: (
                    <span class="font-mono" style="display:inline-flex;gap:8px;align-items:center">
                      {a.url} <CopyButton text={a.url} label="Copy canonical URL" />
                    </span>
                  ),
                }
              : { label: "", value: undefined },
            {
              label: "Conforms to",
              value: profiles.length ? (
                <>
                  {profiles.map((p: string, i: number) => {
                    const href = ctx.links.hrefFor(p);
                    const name = p.split("/").pop();
                    return (
                      <>
                        {i > 0 ? ", " : ""}
                        {href ? <a href={href}>{name}</a> : name}
                      </>
                    );
                  })}
                </>
              ) : undefined,
            },
          ]}
        />
      </Card>

      {ctx.jsonHtml ? (
        <Card title="Resource content">
          <div class="json-view" data-pagefind-ignore dangerouslySetInnerHTML={{ __html: ctx.jsonHtml }} />
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
