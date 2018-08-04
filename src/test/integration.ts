import chai from "chai";
import childProcess from "child_process";

const c8Path = require.resolve("../../build/bin/c8");

chai.should();

describe("c8", () => {
  it("reports coverage for script that exits normally", () => {
    const {stdout} = childProcess.spawnSync(process.execPath, [
      c8Path,
      process.execPath,
      require.resolve("./fixtures/normal"),
    ], {
      env: process.env,
      cwd: process.cwd(),
    });
    stdout.toString("UTF-8").should.include(`
------------|----------|----------|----------|----------|----------------|
File        |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
------------|----------|----------|----------|----------|----------------|
All files   |    91.67 |      100 |       80 |    91.67 |                |
 normal.js  |    85.71 |      100 |       50 |    85.71 |       14,15,16 |
 timeout.js |      100 |      100 |      100 |      100 |                |
------------|----------|----------|----------|----------|----------------|`);
  });
});
