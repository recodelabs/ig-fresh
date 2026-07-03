import { describe, it, expect } from "vitest";
import { buildElementTree } from "../src/model/element-tree.js";

// Hand-crafted minimal StructureDefinition exercising nesting, slices,
// choice types, bindings, flags, fixed values.
const sd = {
  resourceType: "StructureDefinition",
  id: "test-profile",
  type: "Task",
  snapshot: {
    element: [
      { id: "Task", path: "Task", min: 0, max: "*" },
      {
        id: "Task.status",
        path: "Task.status",
        min: 1,
        max: "1",
        short: "task status",
        type: [{ code: "code" }],
        mustSupport: true,
        isModifier: true,
        isSummary: true,
        binding: { strength: "required", valueSet: "http://hl7.org/fhir/ValueSet/task-status|4.0.1" },
      },
      {
        id: "Task.code",
        path: "Task.code",
        min: 1,
        max: "1",
        type: [{ code: "CodeableConcept" }],
        patternCodeableConcept: { coding: [{ system: "http://x", code: "revisit" }] },
      },
      {
        id: "Task.input",
        path: "Task.input",
        min: 0,
        max: "*",
        type: [{ code: "BackboneElement" }],
      },
      {
        id: "Task.input:reason",
        path: "Task.input",
        sliceName: "reason",
        min: 0,
        max: "1",
        type: [{ code: "BackboneElement" }],
        mustSupport: true,
      },
      {
        id: "Task.input:reason.value[x]",
        path: "Task.input.value[x]",
        min: 1,
        max: "1",
        type: [{ code: "CodeableConcept" }, { code: "string" }],
      },
    ],
  },
  differential: {
    element: [
      { id: "Task.status", path: "Task.status" },
      { id: "Task.input:reason", path: "Task.input", sliceName: "reason" },
      { id: "Task.input:reason.value[x]", path: "Task.input.value[x]" },
    ],
  },
};

describe("buildElementTree", () => {
  const { root } = buildElementTree(sd);

  it("nests children under the root resource element", () => {
    expect(root.path).toBe("Task");
    expect(root.children.map((c) => c.label)).toEqual(["status", "code", "input"]);
  });

  it("nests slices under the sliced element, labelled by sliceName", () => {
    const input = root.children[2];
    expect(input.children).toHaveLength(1);
    expect(input.children[0].sliceName).toBe("reason");
    expect(input.children[0].label).toBe("reason");
    // slice child nests under the slice, not under the base element
    expect(input.children[0].children[0].label).toBe("value[x]");
  });

  it("captures cardinality, flags, and bindings", () => {
    const status = root.children[0];
    expect(status.min).toBe(1);
    expect(status.max).toBe("1");
    expect(status.mustSupport).toBe(true);
    expect(status.isModifier).toBe(true);
    expect(status.isSummary).toBe(true);
    expect(status.binding).toEqual({
      strength: "required",
      valueSet: "http://hl7.org/fhir/ValueSet/task-status|4.0.1",
    });
  });

  it("lists all choice types", () => {
    const valueX = root.children[2].children[0].children[0];
    expect(valueX.types.map((t) => t.code)).toEqual(["CodeableConcept", "string"]);
  });

  it("renders fixed/pattern values", () => {
    const code = root.children[1];
    expect(code.fixed).toContain("revisit");
  });

  it("marks differential membership", () => {
    expect(root.children[0].inDifferential).toBe(true); // status
    expect(root.children[1].inDifferential).toBe(false); // code (snapshot only)
  });

  it("falls back to differential when there is no snapshot", () => {
    const diffOnly = { ...sd, snapshot: undefined };
    const { root: r } = buildElementTree(diffOnly);
    expect(r.children.length).toBeGreaterThan(0);
    expect(r.children.every((c) => c.inDifferential)).toBe(true);
  });
});
