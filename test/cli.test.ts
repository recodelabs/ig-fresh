import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/cli-args.js";

describe("parseArgs", () => {
  it("parses a build invocation", () => {
    expect(parseArgs(["build", "-i", "a", "-o", "b"])).toEqual({
      cmd: "build",
      input: "a",
      out: "b",
      verbose: false,
    });
  });

  it("supports long flags and --verbose", () => {
    expect(parseArgs(["build", "--input", "x", "--out", "y", "--verbose"])).toEqual({
      cmd: "build",
      input: "x",
      out: "y",
      verbose: true,
    });
  });

  it("returns help for --help or missing command", () => {
    expect(parseArgs(["--help"]).cmd).toBe("help");
    expect(parseArgs([]).cmd).toBe("help");
  });

  it("throws on build without input/out", () => {
    expect(() => parseArgs(["build", "-i", "a"])).toThrow(/--out/);
    expect(() => parseArgs(["build", "-o", "b"])).toThrow(/--input/);
  });
});
