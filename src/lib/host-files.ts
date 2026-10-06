/** Best-effort local file reads. Safe on Node; no-ops on Workers without fs. */
export async function readHostFile(relativePaths: string[]): Promise<Uint8Array | undefined> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const roots: string[] = [];
    const cwd = process.cwd();
    roots.push(cwd);
    const lambdaRoot = process.env["LAMBDA_TASK_ROOT"] ?? process.env["VERCEL_DIR"] ?? "";
    if (lambdaRoot) roots.push(lambdaRoot);
    try {
      roots.push(dirname(fileURLToPath(import.meta.url)));
    } catch {
      /* bundled without import.meta.url */
    }
    try {
      roots.push(fileURLToPath(new URL(".", import.meta.url)));
      roots.push(fileURLToPath(new URL("../..", import.meta.url)));
      roots.push(fileURLToPath(new URL("../../..", import.meta.url)));
    } catch {
      /* ignore */
    }
    const uniqueRoots = [...new Set(roots.filter(Boolean))];
    for (const root of uniqueRoots) {
      for (const relative of relativePaths) {
        const names = [relative, relative.replaceAll("\\", "/")];
        const base = relative.split(/[/\\]/).pop();
        if (base) names.push(base);
        for (const name of names) {
          try {
            return await readFile(join(root, name));
          } catch {
            /* try the next candidate */
          }
        }
      }
    }
  } catch {
    /* runtime has no filesystem */
  }
  return undefined;
}

export async function readHostText(relativePaths: string[]): Promise<string | undefined> {
  const bytes = await readHostFile(relativePaths);
  return bytes ? new TextDecoder().decode(bytes) : undefined;
}

export async function findHostFile(relativePaths: string[]): Promise<string | undefined> {
  try {
    const { access } = await import("node:fs/promises");
    const { constants } = await import("node:fs");
    const { join } = await import("node:path");
    const root = process.cwd();
    for (const relative of relativePaths) {
      const full = join(root, relative);
      try {
        await access(full, constants.R_OK);
        return full;
      } catch {
        /* try the next candidate */
      }
    }
  } catch {
    /* runtime has no filesystem */
  }
  return undefined;
}

export function toBase64(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function toArrayBuffer(body: ArrayBuffer | Uint8Array): ArrayBuffer {
  const view = body instanceof Uint8Array ? body : new Uint8Array(body);
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(view);
  return copy;
}
