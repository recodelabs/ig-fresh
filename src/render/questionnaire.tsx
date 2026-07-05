import type { VNode } from "preact";
import type { Artifact } from "../model/types.js";
import { Card, CopyButton, KindBadge, MetaGrid, StatusPill, TagBadges } from "./components.js";
import { collectAnswerValueSets, resolveLocalOptions } from "./local-valuesets.js";
import type { RenderCtx } from "./structure-definition.js";

interface QItem {
  linkId?: string;
  text?: string;
  type?: string;
  required?: boolean;
  repeats?: boolean;
  readOnly?: boolean;
  answerValueSet?: string;
  answerOption?: unknown[];
  enableWhen?: unknown[];
  item?: QItem[];
}

const TYPE_LABEL: Record<string, string> = {
  group: "group",
  display: "display",
  boolean: "yes / no",
  decimal: "decimal",
  integer: "integer",
  date: "date",
  dateTime: "date + time",
  time: "time",
  string: "text",
  text: "long text",
  url: "url",
  choice: "choice",
  "open-choice": "open choice",
  attachment: "attachment",
  reference: "reference",
  quantity: "quantity",
  coding: "coding",
};

function countLeaves(items: QItem[] | undefined): number {
  if (!items) return 0;
  let n = 0;
  for (const it of items) {
    if (it.type === "group" || it.type === "display") n += countLeaves(it.item);
    else n += 1 + countLeaves(it.item);
  }
  return n;
}

function ItemRows({ items, depth, ctx }: { items: QItem[]; depth: number; ctx: RenderCtx }): VNode {
  return (
    <>
      {items.map((it) => {
        const isGroup = it.type === "group";
        const vsHref = it.answerValueSet ? ctx.links.hrefFor(it.answerValueSet) : undefined;
        return (
          <>
            <tr class={isGroup ? "q-group-row" : undefined}>
              <td>
                <span style={`padding-left:${depth * 20}px;display:inline-flex;gap:8px;align-items:baseline`}>
                  {isGroup ? (
                    <span class="q-group-mark" aria-hidden="true">▸</span>
                  ) : (
                    <span class="q-leaf-mark" aria-hidden="true" />
                  )}
                  <span class={isGroup ? "q-group-text" : undefined}>{it.text ?? it.linkId}</span>
                </span>
              </td>
              <td>
                <span class="code-chip" style="font-size:11px">{TYPE_LABEL[it.type ?? ""] ?? it.type}</span>
              </td>
              <td>
                {it.required ? <span class="flag-badge flag-mod" title="Required">req</span> : null}
                {it.repeats ? <span class="flag-badge flag-sum" title="Repeats" style="margin-left:4px">↻</span> : null}
                {it.enableWhen ? (
                  <span class="flag-badge flag-sum" title="Conditional (enableWhen)" style="margin-left:4px">?</span>
                ) : null}
              </td>
              <td class="font-mono" style="font-size:11px;color:var(--ink-faint)">
                {it.linkId}
                {vsHref ? (
                  <>
                    {" · "}
                    <a href={vsHref}>{it.answerValueSet!.split("/").pop()?.split("|")[0]}</a>
                  </>
                ) : it.answerOption ? (
                  <span> · {it.answerOption.length} options</span>
                ) : null}
              </td>
            </tr>
            {it.item?.length ? <ItemRows items={it.item} depth={depth + 1} ctx={ctx} /> : null}
          </>
        );
      })}
    </>
  );
}

export function renderQuestionnaire(a: Artifact, ctx: RenderCtx): VNode {
  const q = a.json;
  const items: QItem[] = q.item ?? [];
  const questionCount = countLeaves(items);
  const jsonUrl = `${a.resourceType}-${a.id}.json`;

  // Options for IG-local answerValueSet canonicals, resolved at build time so
  // the interactive preview never needs an external terminology server for
  // ValueSets this IG defines itself. Empty for questionnaires without any
  // (locally resolvable) answerValueSet — then no blob is emitted at all.
  const localVs = resolveLocalOptions(collectAnswerValueSets(items), ctx.model.artifacts, ctx.expansions);
  const localVsJson = Object.keys(localVs).length
    ? JSON.stringify(localVs).replace(/</g, "\\u003c")
    : undefined;

  return (
    <article>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px">
        <KindBadge kind={a.kind} />
        <StatusPill status={a.status} version={a.version} />
        <TagBadges tags={a.tags} />
      </div>
      <h1 style="margin-top:10px">{q.title ?? q.name ?? a.id}</h1>
      {a.description ? <p class="page-lede">{a.description}</p> : null}

      <Card>
        <MetaGrid
          rows={[
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
            { label: "Questions", value: String(questionCount) },
            { label: "Subject type", value: (q.subjectType ?? []).join(", ") || undefined },
          ]}
        />
      </Card>

      <Card title="Form">
        <div class="tab-list" role="tablist" style="margin-bottom:14px">
          <button type="button" class="tab-btn" role="tab" data-q-tab="preview" aria-selected="true">
            Interactive preview
          </button>
          <button type="button" class="tab-btn" role="tab" data-q-tab="structure" aria-selected="false">
            Item structure
          </button>
          <button type="button" class="tab-btn" role="tab" data-q-tab="json" aria-selected="false">
            JSON
          </button>
        </div>

        {/* Preview: formbox island, auto-mounted on load */}
        <div data-q-panel="preview">
          {localVsJson ? (
            <script
              type="application/json"
              id="igf-vs-options"
              dangerouslySetInnerHTML={{ __html: localVsJson }}
            />
          ) : null}
          <div
            class="q-preview"
            data-questionnaire-preview
            data-questionnaire-src={jsonUrl}
          >
            <div class="q-preview-loading" role="status">
              <span class="q-spinner" aria-hidden="true" />
              Rendering interactive form…
            </div>
          </div>
        </div>

        {/* Item structure: static, always available */}
        <div data-q-panel="structure" hidden>
          <div style="overflow-x:auto">
            <table class="data-table q-structure">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Flags</th>
                  <th>Link ID</th>
                </tr>
              </thead>
              <tbody>
                <ItemRows items={items} depth={0} ctx={ctx} />
              </tbody>
            </table>
          </div>
        </div>

        {/* JSON */}
        <div data-q-panel="json" hidden>
          {ctx.jsonHtml ? (
            <>
              <div class="json-view" data-pagefind-ignore dangerouslySetInnerHTML={{ __html: ctx.jsonHtml }} />
              <p style="margin:10px 0 0;font-size:12px;color:var(--ink-faint)">
                Raw renditions: <a href={jsonUrl}>JSON</a> ·{" "}
                <a href={`${a.resourceType}-${a.id}.xml`}>XML</a>
              </p>
            </>
          ) : null}
        </div>
      </Card>
    </article>
  );
}
