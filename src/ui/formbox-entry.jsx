// Standalone, lazily-loaded island that renders a FHIR Questionnaire as an
// interactive form using @formbox/renderer (the same library Cinder exposes).
// Bundled once by ig-fresh into igf/formbox.js and shared across all
// questionnaire pages — the questionnaire JSON is fetched at mount time.
import React from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import Renderer from "@formbox/renderer";
import { theme as formboxTheme } from "@formbox/mantine-theme";
import "@mantine/core/styles.css";
import "@formbox/mantine-theme/style.css";
import { applyLocalValueSets } from "./apply-local-valuesets.js";

/**
 * Mount an interactive questionnaire preview.
 * @param {HTMLElement} el       container element
 * @param {object} questionnaire FHIR R4 Questionnaire resource
 * @param {object} [opts]        { terminologyServerUrl?: string, localValueSets?: object }
 */
function mount(el, questionnaire, opts = {}) {
  // Rewrite IG-local answerValueSet references into inline answerOption before
  // the renderer sees them — its only other path is a terminology server,
  // which cannot expand ValueSets that exist only in this IG.
  if (opts.localValueSets) {
    try {
      questionnaire = applyLocalValueSets(questionnaire, opts.localValueSets);
    } catch (e) {
      // fall through with the original questionnaire — preview still renders
    }
  }
  const props = {
    questionnaire,
    fhirVersion: "r4",
    mode: "capture",
    theme: formboxTheme,
    onSubmit: () => {},
  };
  if (opts.terminologyServerUrl) props.terminologyServerUrl = opts.terminologyServerUrl;
  createRoot(el).render(
    React.createElement(
      MantineProvider,
      { theme: formboxTheme, forceColorScheme: "light" },
      React.createElement(Renderer, props),
    ),
  );
}

window.igfMountQuestionnaire = mount;
