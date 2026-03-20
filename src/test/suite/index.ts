import * as path from "path";
import Mocha from "mocha";
import { sync as globSync } from "glob";

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    timeout: 60000,
  });

  const testsRoot = path.resolve(__dirname, ".");

  return new Promise((resolve, reject) => {
    const files = globSync("**/**.test.js", { cwd: testsRoot });

    files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

    try {
      mocha.run((failures: number) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });
}
