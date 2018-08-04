#!/usr/bin/env node

import foreground from "foreground-child";
import mkdirp from "mkdirp";
import path from "path";
import rimraf from "rimraf";
import sw from "spawn-wrap";
import { hideInstrumenteeArgs, hideInstrumenterArgs, yargs } from "../lib/parse-args";
import { report } from "../lib/report";

const instrumenterArgs = hideInstrumenteeArgs();

const argv = yargs.parse(instrumenterArgs);

const tmpDirctory = path.resolve(argv.coverageDirectory, "./tmp");
rimraf.sync(tmpDirctory);
mkdirp.sync(tmpDirctory);

sw([require.resolve("../lib/wrap")], {
  C8_ARGV: JSON.stringify(argv),
});

foreground(hideInstrumenterArgs(argv), (out: any) => {
  report({
    reporter: Array.isArray(argv.reporter) ? argv.reporter : [argv.reporter],
    coverageDirectory: argv.coverageDirectory,
    watermarks: argv.watermarks,
  });
});
