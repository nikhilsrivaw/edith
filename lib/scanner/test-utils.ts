/**
 * Shared test harness for building a RepoProject in tests.
 */
import { Project, ScriptTarget, ModuleKind, ModuleResolutionKind } from "ts-morph";
import type { RepoProject } from "./project";
import type { FetchedFile } from "./github-tree";

const TS_EXT = /\.(tsx?|jsx?|mjs|cjs)$/;

export function buildTestProject(files: FetchedFile[]): RepoProject {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      target: ScriptTarget.ES2022,
      module: ModuleKind.ESNext,
      moduleResolution: ModuleResolutionKind.Bundler,
      jsx: 4,
      allowJs: true,
      esModuleInterop: true,
      strict: false,
      noEmit: true,
      skipLibCheck: true,
    },
  });
  const tsFiles: FetchedFile[] = [];
  const fileMap = new Map<string, FetchedFile>();
  for (const f of files) {
    fileMap.set(f.path, f);
    if (!TS_EXT.test(f.path)) continue;
    tsFiles.push(f);
    try {
      project.createSourceFile("/" + f.path, f.content, { overwrite: true });
    } catch {
      /* */
    }
  }
  return { project, fileMap, tsFiles };
}
