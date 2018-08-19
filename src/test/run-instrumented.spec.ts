import chai from "chai";
import path from "path";
import { runInstrumented } from "../lib/run-instrumented";
import Protocol from "devtools-protocol";

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

describe("run-instrumented", () => {
  describe("normal.js", () => {
    const FIXTURE = require.resolve("./fixtures/normal.js");

    it("runs it successfully", async () => {
      const coverage: any[] = await runInstrumented([FIXTURE], inFixturesDirectory);
      chai.assert.isArray(coverage);
      chai.assert.lengthOf(coverage, 2);
    });
  });
});
