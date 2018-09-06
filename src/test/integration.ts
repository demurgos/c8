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
    stdout.toString("UTF-8").should.include(`------------|----------|----------|----------|----------|-------------------|
File        |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
------------|----------|----------|----------|----------|-------------------|
All files   |    97.67 |      100 |    66.67 |      100 |                   |
 normal.js  |    96.43 |      100 |       50 |      100 |                   |
 timeout.js |      100 |      100 |       80 |      100 |                   |
------------|----------|----------|----------|----------|-------------------|`);
  });
});
