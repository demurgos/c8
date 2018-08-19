// #!/usr/bin/env node
//
// import assert from "assert";
// import fs from "fs";
// import inspector, { Profiler } from "inspector";
// import path from "path";
// import onExit from "signal-exit";
// import { ChildProcessProxy, observeSpawn, SpawnEvent } from "demurgos-spawn-wrap";
// import Exclude from "test-exclude";
// import uuid from "uuid";
// import Protocol from "devtools-protocol";
// import { unwrapNodeCjsCoverage } from "v8-to-istanbul";
// import events from "events";
// import cri from "chrome-remote-interface";
// import childProcess from "child_process";
//
// // Internal aliases
// type ScriptCov = Protocol.Profiler.ScriptCoverage;
// type FnCov = Protocol.Profiler.FunctionCoverage;
// type CovRange = Protocol.Profiler.CoverageRange;
//
// assert(process.env.C8_ARGV !== undefined);
// const argv = JSON.parse(process.env.C8_ARGV!);
//
// export async function runInstrumented(file: string, args: ReadonlyArray<string>): Promise<any> {
//   observeSpawn(file, args)
//     .subscribe(
//       async (ev: SpawnEvent) => {
//         const proxy = ev.proxySpawn(["--inspect=0", ...ev.args]);
//         const debuggerPort: number = await getDebuggerPort(proxy);
//         const coverage = await getCoverage(debuggerPort);
//         console.log(coverage);
//       },
//       (error: Error) => console.error(error),
//       () => {
//         console.log("complete");
//       },
//     )
// }
//
// const DEBUGGER_URI_RE = /ws:\/\/.*?:(\d+)\//;
// // In milliseconds (1s)
// const GET_DEBUGGER_PORT_TIMEOUT = 1000;
// // In milliseconds (10s)
// const GET_COVERAGE_TIMEOUT = 10000;
//
// export async function getDebuggerPort(proc: ChildProcessProxy): Promise<number> {
//   return new Promise<number>((resolve, reject) => {
//     const timeoutId: NodeJS.Timer = setTimeout(onTimeout, GET_DEBUGGER_PORT_TIMEOUT);
//     let stderrBuffer: Buffer = Buffer.alloc(0);
//     proc.stderr.on("data", onStderrData);
//     proc.stderr.on("close", onClose);
//
//     function onStderrData(chunk: Buffer): void {
//       stderrBuffer = Buffer.concat([stderrBuffer, chunk]);
//       const stderrStr = stderrBuffer.toString("UTF-8");
//       const match = DEBUGGER_URI_RE.exec(stderrStr);
//       if (match === null) {
//         return;
//       }
//       const result: number = parseInt(match[1], 10);
//       removeListeners();
//       resolve(result);
//     }
//
//     function onClose(code: number | null, signal: string | null): void {
//       removeListeners();
//       reject(new Error(`Unable to hook inspector (early exit, ${code}, ${signal})`));
//     }
//
//     function onTimeout(): void {
//       removeListeners();
//       reject(new Error(`Unable to hook inspector (timeout)`));
//       proc.kill();
//     }
//
//     function removeListeners(): void {
//       proc.stderr.removeListener("data", onStderrData);
//       proc.stderr.removeListener("close", onClose);
//       clearTimeout(timeoutId);
//     }
//   });
// }
//
// interface CoverageData {
//   url: string;
//   source: string;
//   functions: Protocol.Profiler.FunctionCoverage[];
// }
//
// async function getCoverage(port: number): Promise<CoverageData[]> {
//   return new Promise<CoverageData[]>(async (resolve, reject) => {
//     const timeoutId: NodeJS.Timer = setTimeout(onTimeout, GET_COVERAGE_TIMEOUT);
//     let client: Protocol.ProtocolApi;
//     let mainExecutionContextId: Protocol.Runtime.ExecutionContextId | undefined;
//     let state: string = "WaitingForMainContext"; // TODO: enum
//     try {
//       client = await cri({port});
//
//       await client.Profiler.enable();
//       await client.Profiler.startPreciseCoverage({callCount: true, detailed: true});
//       await client.Debugger.enable();
//
//       (client as any as events.EventEmitter).once("Runtime.executionContextCreated", onMainContextCreation);
//       (client as any as events.EventEmitter).on("Runtime.executionContextDestroyed", onContextDestruction);
//
//       await client.Runtime.enable();
//     } catch (err) {
//       removeListeners();
//       reject(err);
//     }
//
//     function onMainContextCreation(ev: Protocol.Runtime.ExecutionContextCreatedEvent) {
//       assert(state === "WaitingForMainContext");
//       mainExecutionContextId = ev.context.id;
//       state = "WaitingForMainContextDestruction";
//     }
//
//     async function onContextDestruction(ev: Protocol.Runtime.ExecutionContextDestroyedEvent): Promise<void> {
//       assert(state === "WaitingForMainContextDestruction");
//       if (ev.executionContextId !== mainExecutionContextId) {
//         return;
//       }
//       state = "WaitingForCoverage";
//
//       try {
//         // await client.Profiler.stopPreciseCoverage();
//         await client.HeapProfiler.collectGarbage();
//         const {result: coverageList} = await client.Profiler.takePreciseCoverage();
//         const result: CoverageData[] = [];
//         for (const coverage of coverageList) {
//           const {scriptSource: source} = await client.Debugger.getScriptSource(coverage);
//           result.push({
//             url: coverage.url,
//             source,
//             functions: coverage.functions,
//           });
//         }
//         resolve(result);
//       } catch (err) {
//         reject(err);
//       } finally {
//         removeListeners();
//       }
//     }
//
//     function onTimeout(): void {
//       removeListeners();
//       reject(new Error(`Unable to get V8 coverage (timeout)`));
//     }
//
//     function removeListeners(): void {
//       (client as any as events.EventEmitter).removeListener("Runtime.executionContextCreated", onMainContextCreation);
//       (client as any as events.EventEmitter).removeListener("Runtime.executionContextDestroyed", onContextDestruction);
//       clearTimeout(timeoutId);
//       (client as any).close();
//     }
//   });
// }
//
// const exclude = Exclude({
//     include: argv.include,
//     exclude: argv.exclude,
//   })
//
// ;(async function runInstrumented() {
//   try {
//     // bootstrap the inspector before kicking
//     // off the user's code.
//     inspector.open(0, true);
//     const session = new inspector.Session();
//     session.connect();
//
//     session.post("Profiler.enable");
//     session.post("Profiler.startPreciseCoverage", {callCount: true, detailed: true});
//     session.post("Runtime.enable");
//
//     // hook process.exit() and common exit signals, e.g., SIGTERM,
//     // and output coverage report when these occur.
//     onExit(() => {
//       session.post("Profiler.takePreciseCoverage", (err, res) => {
//         if (err) {
//           console.warn(err.message);
//           return;
//         }
//         try {
//           const allCoverages: ScriptCov[] = res.result;
//           const coverages: ScriptCov[] = filterCoverages(allCoverages);
//           emitCoverages(coverages);
//         } catch (err) {
//           console.warn(err.message);
//         }
//       });
//     }, {alwaysLast: true});
//
//     // run the user's actual application.
//     sw.runMain();
//   } catch (err) {
//     console.error(err);
//     process.exit(1);
//   }
// })();
//
// function filterCoverages(coverages: ScriptCov[]): ScriptCov[] {
//   const filtered: ScriptCov[] = [];
//   for (const coverage of coverages) {
//     const url = coverage.url.replace("file://", "");
//     if (path.isAbsolute(url) && exclude.shouldInstrument(url) && url !== __filename) {
//       filtered.push(coverage);
//     }
//   }
//   return filtered;
// }
//
// function emitCoverages(coverages: ScriptCov[]): void {
//   const tmpDir: string = path.resolve(argv.coverageDirectory, "tmp");
//   for (const coverage of coverages) {
//     const fileName: string = `${uuid.v4()}.json`;
//     let data: {url: string, functions: FnCov[]};
//     if (coverage.url.startsWith("file://")) {
//       data = {url: coverage.url, functions: coverage.functions};
//     } else {
//       data = unwrapNodeCjsCoverage(coverage);
//     }
//     writeJsonFileSync(path.resolve(tmpDir, fileName), coverage);
//   }
// }
//
// function writeJsonFileSync(path: string, data: any): void {
//   fs.writeFileSync(path, JSON.stringify(data, null, 2), "UTF-8");
// }
