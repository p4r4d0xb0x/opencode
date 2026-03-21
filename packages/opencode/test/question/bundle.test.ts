import { afterEach, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { pathToFileURL } from "url"

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

test("bundled question route initializes", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-question-bundle-"))
  dirs.push(dir)
  const proc = Bun.spawn({
    cmd: [
      "bun",
      "build",
      "./src/server/routes/question.ts",
      "--target=bun",
      "--format=esm",
      `--outdir=${dir}`,
    ],
    cwd: path.resolve(import.meta.dir, "../.."),
    stdout: "ignore",
    stderr: "pipe",
  })
  const code = await proc.exited

  expect(code).toBe(0)
  expect(await new Response(proc.stderr).text()).toBe("")

  const mod = await import(pathToFileURL(path.join(dir, "question.js")).href)
  expect(() => mod.QuestionRoutes()).not.toThrow()
})
