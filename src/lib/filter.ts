import Protocol from "devtools-protocol";
import path from "path";

export type CoverageFilter = (ev: Protocol.Debugger.ScriptParsedEvent) => boolean;

export function fromGlob(patterns: string[]): CoverageFilter {
  // TODO: Actually create a filter based on the glob
  console.warn("NotImplemented: fromGlob (fallback to `() => inCwd`)");
  return inCwd;
}

function inCwd(ev: Protocol.Debugger.ScriptParsedEvent): boolean {
  if (ev.isModule === true) {
    return false;
  }
  if (ev.url.startsWith("file://")) {
    return false;
  }
  if (!path.isAbsolute(ev.url)) {
    return false;
  }
  return isDescendantOf(ev.url, process.cwd()) && !isDescendantOf(ev.url, path.resolve(process.cwd(), "node_modules"));
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
