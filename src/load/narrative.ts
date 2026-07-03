import * as cheerio from "cheerio";

/**
 * Extract the authored content region from a publisher-generated HTML page,
 * dropping the publisher chrome (header, navbar, publish-box, breadcrumbs, footer, scripts).
 */
export function extractNarrative(html: string): { title?: string; bodyHtml: string } {
  const $ = cheerio.load(html);
  const title = $("head > title").text() || undefined;

  let region = $("#segment-content .col-12").first();
  if (!region.length) region = $("#segment-content").first();
  if (!region.length) region = $("main").first();
  if (!region.length) region = $("body").first();

  region.find("script, style").remove();
  region.find(".publish-box, #publish-box").remove();
  region.find("#segment-breadcrumb, .breadcrumb").remove();
  region.find("#markdown-toc").closest("div").addClass("ig-toc");

  return { title, bodyHtml: region.html() ?? "" };
}
