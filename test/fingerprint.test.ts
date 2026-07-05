import { describe, it, expect } from "vitest";
import { contentHash, fingerprintName } from "../src/build/fingerprint.js";

describe("contentHash", () => {
  it("is deterministic: identical input yields the identical hash", () => {
    expect(contentHash("console.log(1)")).toBe(contentHash("console.log(1)"));
    expect(contentHash(Buffer.from("abc"))).toBe(contentHash(Buffer.from("abc")));
    // string and equivalent Buffer hash the same bytes
    expect(contentHash("abc")).toBe(contentHash(Buffer.from("abc")));
  });

  it("changes when the content changes (cache-busting property)", () => {
    expect(contentHash("v1")).not.toBe(contentHash("v2"));
    // a single-byte change flips the hash
    expect(contentHash("payload")).not.toBe(contentHash("payloaD"));
  });

  it("is 8 lowercase hex characters", () => {
    const h = contentHash("anything");
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("fingerprintName", () => {
  it("inserts the hash before the final extension", () => {
    expect(fingerprintName("site.js", "a1b2c3d4")).toBe("site.a1b2c3d4.js");
    expect(fingerprintName("site.css", "deadbeef")).toBe("site.deadbeef.css");
    expect(fingerprintName("formbox.js", "00112233")).toBe("formbox.00112233.js");
  });

  it("only splits on the final dot", () => {
    expect(fingerprintName("site.built.css", "abcd0000")).toBe("site.built.abcd0000.css");
  });

  it("appends the hash when there is no extension", () => {
    expect(fingerprintName("LICENSE", "abcd0000")).toBe("LICENSE.abcd0000");
  });
});
