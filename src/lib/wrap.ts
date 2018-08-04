#!/usr/bin/env node

import assert from "assert";
import fs from "fs";
import inspector from "inspector";
import path from "path";
import onExit from "signal-exit";
import sw from "spawn-wrap";
import Exclude from "test-exclude";
import uuid from "uuid";
import v8ToIstanbul from "v8-to-istanbul";

assert(process.env.C8_ARGV !== undefined);
const argv = JSON.parse(process.env.C8_ARGV!);

const exclude = Exclude({
    include: argv.include,
    exclude: argv.exclude,
  })

; (async function runInstrumented() {
  try {
    // bootstrap the inspector before kicking
    // off the user's code.
    inspector.open(0, true);
    const session = new inspector.Session();
    session.connect();

    session.post("Profiler.enable");
    session.post("Runtime.enable");
    session.post(
      "Profiler.startPreciseCoverage",
      {callCount: true, detailed: true},
    );

    // hook process.exit() and common exit signals, e.g., SIGTERM,
    // and output coverage report when these occur.
    onExit(() => {
      session.post("Profiler.takePreciseCoverage", (err, res) => {
        if (err) { console.warn(err.message); }
        else {
          try {
            const result = filterResult(res.result);
            writeIstanbulFormatCoverage(result);
          } catch (err) {
            console.warn(err.message);
          }
        }
      });
    }, {alwaysLast: true});

    // run the user's actual application.
    sw.runMain();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

function filterResult(result) {
  result = result.filter(({url}) => {
    url = url.replace("file://", "");
    return path.isAbsolute(url) &&
      exclude.shouldInstrument(url) &&
      url !== __filename;
  });
  return result;
}

function writeIstanbulFormatCoverage(allV8Coverage) {
  const tmpDirctory = path.resolve(argv.coverageDirectory, "./tmp");
  allV8Coverage.forEach((v8) => {
    const script = v8ToIstanbul(v8.url);
    script.applyCoverage(v8.functions);
    fs.writeFileSync(
      path.resolve(tmpDirctory, `./${uuid.v4()}.json`),
      JSON.stringify(script.toIstanbul(), null, 2),
      "utf8",
    );
  });
}
