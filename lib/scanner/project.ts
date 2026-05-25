/**
 * Build an in-memory ts-morph Project from fetched repo files.
 * Used by AST-based checks (checks-v1).
 */
import "server-only";
import { Project, ScriptTarget, ModuleKind, ModuleResolutionKind } from "ts-morph";
import type { FetchedFile } from "./github-tree";

export type RepoProject = {
  project: Project;
  fileMap: Map<string, FetchedFile>;
  tsFiles: FetchedFile[];
};

const TS_EXT = /\.(tsx?|jsx?|mjs|cjs)$/;

export function createRepoProject(files: FetchedFile[]): RepoProject {
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
      allowSyntheticDefaultImports: true,
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
      // ignore unparseable files — checks-v0 will still see them via fileMap
    }
  }

  return { project, fileMap, tsFiles };
}
