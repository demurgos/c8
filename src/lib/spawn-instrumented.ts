import assert from "assert";
import cri from "chrome-remote-interface";
import { ChildProcessProxy, observeSpawn, SpawnEvent } from "demurgos-spawn-wrap";
import Protocol from "devtools-protocol";
import events from "events";

const DEBUGGER_URI_RE = /ws:\/\/.*?:(\d+)\//;
// In milliseconds (1s)
const GET_DEBUGGER_PORT_TIMEOUT = 1000;
// In milliseconds (10s)
const GET_COVERAGE_TIMEOUT = 10000;

export interface CoverageData {
  url: string;
  source: string;
  functions: Protocol.Profiler.FunctionCoverage[];
}

export async function spawnInstrumented(
  file: string,
  args: ReadonlyArray<string>,
  filter?: (ev: Protocol.Debugger.ScriptParsedEvent) => boolean,
): Promise<CoverageData[]> {
  const coverageData: CoverageData[] = [];

  return new Promise<CoverageData[]>((resolve, reject) => {
    observeSpawn(file, args)
      .subscribe(
        async (ev: SpawnEvent) => {
          const proxy = ev.proxySpawn(["--inspect=0", ...ev.args]);
          const debuggerPort: number = await getDebuggerPort(proxy);
          const coverage = await getCoverage(debuggerPort, filter);
          coverageData.splice(coverageData.length, 0, ...coverage);
        },
        (error: Error) => reject(error),
        () => resolve(coverageData),
      );
  });
}

export async function getDebuggerPort(proc: ChildProcessProxy): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const timeoutId: NodeJS.Timer = setTimeout(onTimeout, GET_DEBUGGER_PORT_TIMEOUT);
    let stderrBuffer: Buffer = Buffer.alloc(0);
    proc.stderr.on("data", onStderrData);
    proc.stderr.on("close", onClose);

    function onStderrData(chunk: Buffer): void {
      stderrBuffer = Buffer.concat([stderrBuffer, chunk]);
      const stderrStr = stderrBuffer.toString("UTF-8");
      const match = DEBUGGER_URI_RE.exec(stderrStr);
      if (match === null) {
        return;
      }
      const result: number = parseInt(match[1], 10);
      removeListeners();
      resolve(result);
    }

    function onClose(code: number | null, signal: string | null): void {
      removeListeners();
      reject(new Error(`Unable to hook inspector (early exit, ${code}, ${signal})`));
    }

    function onTimeout(): void {
      removeListeners();
      reject(new Error(`Unable to hook inspector (timeout)`));
      // proc.kill();
    }

    function removeListeners(): void {
      proc.stderr.removeListener("data", onStderrData);
      proc.stderr.removeListener("close", onClose);
      clearTimeout(timeoutId);
    }
  });
}

async function getCoverage(
  port: number,
  filter?: (ev: Protocol.Debugger.ScriptParsedEvent) => boolean,
): Promise<CoverageData[]> {
  return new Promise<CoverageData[]>(async (resolve, reject) => {
    const timeoutId: NodeJS.Timer = setTimeout(onTimeout, GET_COVERAGE_TIMEOUT);
    let client: Protocol.ProtocolApi;
    let mainExecutionContextId: Protocol.Runtime.ExecutionContextId | undefined;
    const scriptsToCollect: Set<Protocol.Runtime.ScriptId> = new Set();
    let state: string = "WaitingForMainContext"; // TODO: enum
    try {
      client = await cri({port});

      await client.Profiler.enable();
      await client.Profiler.startPreciseCoverage({callCount: true, detailed: true});
      await client.Debugger.enable();

      (client as any as events.EventEmitter).once("Runtime.executionContextCreated", onMainContextCreation);
      (client as any as events.EventEmitter).on("Runtime.executionContextDestroyed", onContextDestruction);
      (client as any as events.EventEmitter).on("Debugger.scriptParsed", onScriptParsed);

      await client.Runtime.enable();
    } catch (err) {
      removeListeners();
      reject(err);
    }

    function onMainContextCreation(ev: Protocol.Runtime.ExecutionContextCreatedEvent) {
      assert(state === "WaitingForMainContext");
      mainExecutionContextId = ev.context.id;
      state = "WaitingForMainContextDestruction";
    }

    function onScriptParsed(ev: Protocol.Debugger.ScriptParsedEvent) {
      const collect: boolean = filter !== undefined ? filter(ev) : true;
      if (collect) {
        // TODO: Store `isModule`?
        scriptsToCollect.add(ev.scriptId);
      }
    }

    async function onContextDestruction(ev: Protocol.Runtime.ExecutionContextDestroyedEvent): Promise<void> {
      assert(state === "WaitingForMainContextDestruction");
      if (ev.executionContextId !== mainExecutionContextId) {
        return;
      }
      state = "WaitingForCoverage";

      try {
        // await client.Profiler.stopPreciseCoverage();
        await client.HeapProfiler.collectGarbage();
        const {result: coverageList} = await client.Profiler.takePreciseCoverage();
        const result: CoverageData[] = [];
        for (const coverage of coverageList) {
          if (!scriptsToCollect.has(coverage.scriptId)) {
            continue;
          }
          const {scriptSource: source} = await client.Debugger.getScriptSource(coverage);
          result.push({
            url: coverage.url,
            source,
            functions: coverage.functions,
          });
        }
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        removeListeners();
      }
    }

    function onTimeout(): void {
      removeListeners();
      reject(new Error(`Unable to get V8 coverage (timeout)`));
    }

    function removeListeners(): void {
      (client as any as events.EventEmitter).removeListener("Runtime.executionContextCreated", onMainContextCreation);
      (client as any as events.EventEmitter).removeListener("Runtime.executionContextDestroyed", onContextDestruction);
      (client as any as events.EventEmitter).removeListener("Runtime.scriptParsed", onScriptParsed);
      clearTimeout(timeoutId);
      (client as any).close();
    }
  });
}
