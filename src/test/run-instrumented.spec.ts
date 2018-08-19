import chai from "chai";
import { runInstrumented } from "../lib/run-instrumented";

describe("run-instrumented", () => {
  describe("normal.js", () => {
    const FIXTURE = require.resolve("./fixtures/normal.js");

    it("runs it successfully", async () => {
      const coverage: any[] = await runInstrumented([FIXTURE]);
      chai.assert.isArray(coverage);
    });
  });
});
