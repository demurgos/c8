import fs from "fs";
import libCoverage from "istanbul-lib-coverage";
import libReport from "istanbul-lib-report";
import reports from "istanbul-reports";
import path from "path";

class Report {
  reporter: any;
  coverageDirectory: any;
  watermarks: any;

  constructor({reporter, coverageDirectory, watermarks}: any) {
    this.reporter = reporter;
    this.coverageDirectory = coverageDirectory;
    this.watermarks = watermarks;
  }

  public run() {
    const map = this._getCoverageMapFromAllCoverageFiles();
    const context = libReport.createContext({
      dir: "./coverage",
      watermarks: this.watermarks,
    });

    const tree = libReport.summarizers.pkg(map);

    this.reporter.forEach((reporter: any) => {
      tree.visit(reports.create(reporter), context);
    });
  }

  public _getCoverageMapFromAllCoverageFiles() {
    const map = libCoverage.createCoverageMap({});

    this._loadReports().forEach((report) => {
      map.merge(report);
    });

    return map;
  }

  public _loadReports() {
    const tmpDirctory = path.resolve(this.coverageDirectory, "./tmp");
    const files = fs.readdirSync(tmpDirctory);

    return files.map((f) => {
      return JSON.parse(fs.readFileSync(
        path.resolve(tmpDirctory, f),
        "utf8",
      ));
    });
  }
}

export function report(opts: any) {
  const report = new Report(opts);
  report.run();
};
