import chai from "chai";
import Protocol from "devtools-protocol";
import path from "path";
import { CoverageData, spawnInstrumented } from "../lib/spawn-instrumented";

function inFixturesDirectory(ev: Protocol.Debugger.ScriptParsedEvent): boolean {
  if (ev.isModule === true) {
    return false;
  }
  if (ev.url.startsWith("file://")) {
    return false;
  }
  if (!path.isAbsolute(ev.url)) {
    return false;
  }
  return isDescendantOf(ev.url, path.resolve(__dirname, "fixtures"));
}

function isDescendantOf(descendantPath: string, ancestorPath: string): boolean {
  if (descendantPath === ancestorPath) {
    return false;
  }
  while (descendantPath !== path.dirname(descendantPath)) {
    descendantPath = path.dirname(descendantPath);
    if (descendantPath === ancestorPath) {
      return true;
    }
  }
  return false;
}

describe("spawnInstrumented", () => {
  describe("node normal.js", () => {
    const FIXTURE = require.resolve("./fixtures/normal.js");

    it("runs it successfully and collect V8 coverage", async () => {
      const coverage: CoverageData[] = await spawnInstrumented(process.execPath, [FIXTURE], inFixturesDirectory);
      chai.assert.isArray(coverage);
      chai.assert.lengthOf(coverage, 2);
    });
  });
});
