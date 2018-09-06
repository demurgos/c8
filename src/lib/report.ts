import libCoverage from "istanbul-lib-coverage";
import libReport from "istanbul-lib-report";
import reports from "istanbul-reports";
import { CoverageData } from "./spawn-instrumented";
import { IstanbulFileCoverageData, unwrapNodeCjsCoverage, unwrapNodeCjsSource, v8ToIstanbul } from "v8-to-istanbul";

export type IstanbulReporter = "text" | "lcov-only";

export interface ReportOptions {
  coverage: CoverageData[];
  reporters: IstanbulReporter[];
  coverageDir: string;
  watermarks: any;
}

export async function writeReports(options: ReportOptions): Promise<void> {
  const map = libCoverage.createCoverageMap({});
  for (const v8Coverage of options.coverage) {
    const istanbulCoverage: IstanbulFileCoverageData = v8ToIstanbul(unwrapNodeCjsCoverage(v8Coverage), unwrapNodeCjsSource(v8Coverage.source));
    map.merge({[istanbulCoverage.path]: istanbulCoverage});
  }
  const tree = libReport.summarizers.pkg(map);
  const context = libReport.createContext({
    dir: options.coverageDir,
    watermarks: options.watermarks,
  });

  for (const reporter of options.reporters) {
    tree.visit(reports.create(reporter), context);
  }
}
