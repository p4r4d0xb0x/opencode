import { expect, test } from "bun:test"
import path from "path"
import { pathToFileURL } from "url"
import { tmpdir } from "../fixture/fixture"

test("bundled server initializes skill route", async () => {
  await using tmp = await tmpdir()
  const proc = Bun.spawn({
    cmd: [
      "bun",
      "build",
      "./src/server/server.ts",
      "--target=bun",
      "--format=esm",
      `--outdir=${tmp.path}`,
    ],
    cwd: path.resolve(import.meta.dir, "../.."),
    stdout: "ignore",
    stderr: "pipe",
  })
  const code = await proc.exited

  expect(code).toBe(0)
  expect(await new Response(proc.stderr).text()).toBe("")

  const mod = await import(pathToFileURL(path.join(tmp.path, "server.js")).href)
  expect(() => mod.Server.Default()).not.toThrow()
})
