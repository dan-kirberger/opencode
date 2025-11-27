import { describe, expect, test, spyOn, mock } from "bun:test"
import * as path from "path"
import { WriteTool } from "../../src/tool/write"
import { Instance } from "../../src/project/instance"
import { LSP } from "../../src/lsp"
import { FileTime } from "../../src/file/time"

const ctx = {
    sessionID: "test",
    messageID: "",
    callID: "",
    agent: "build",
    abort: AbortSignal.any([]),
    metadata: () => { },
}

import { tmpdir } from "../../test/fixture/fixture"

describe("tool.write", () => {
    test("truncates large output from single file", async () => {
        await using tmp = await tmpdir()
        await Instance.provide({
            directory: tmp.path,
            fn: async () => {
                // Mock LSP.diagnostics to return a large number of issues for a SINGLE file
                const largeDiagnostics: Record<string, any[]> = {}
                const issues = []
                for (let i = 0; i < 2000; i++) {
                    issues.push({
                        message: "Error message " + i,
                        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
                        severity: 1,
                    })
                }
                largeDiagnostics["huge_file.ts"] = issues

                const originalDiagnostics = LSP.diagnostics
                // @ts-ignore
                LSP.diagnostics = async () => largeDiagnostics

                const originalTouchFile = LSP.touchFile
                // @ts-ignore
                LSP.touchFile = async () => { }

                // Mock FileTime.assert to avoid read check
                const originalAssert = FileTime.assert
                // @ts-ignore
                FileTime.assert = async () => { }

                // Mock Bun.write to avoid actual file write
                const originalWrite = Bun.write
                // @ts-ignore
                Bun.write = async () => { }

                try {
                    const tool = await WriteTool.init()
                    const result = await tool.execute(
                        {
                            filePath: path.join(tmp.path, "test_file.ts"),
                            content: "console.log('hello')",
                        },
                        ctx,
                    )

                    expect(result.output.length).toBeLessThan(35000)
                    expect(result.output).toContain("(Output was truncated due to length limit)")
                } finally {
                    // Restore mocks
                    // @ts-ignore
                    LSP.diagnostics = originalDiagnostics
                    // @ts-ignore
                    LSP.touchFile = originalTouchFile
                    // @ts-ignore
                    FileTime.assert = originalAssert
                    // @ts-ignore
                    Bun.write = originalWrite
                }
            },
        })
    })

    test("truncates large output from multiple files", async () => {
        await using tmp = await tmpdir()
        await Instance.provide({
            directory: tmp.path,
            fn: async () => {
                // Mock LSP.diagnostics to return a large number of issues
                const largeDiagnostics: Record<string, any[]> = {}
                for (let i = 0; i < 1000; i++) {
                    largeDiagnostics[`file_${i}.ts`] = [
                        {
                            message: "Error message " + i,
                            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
                            severity: 1,
                        },
                    ]
                }

                // We need to mock LSP.diagnostics. 
                // Since LSP is a namespace, we might need to mock the function directly if possible, 
                // or use a different approach if it's a direct export.
                // Looking at lsp/index.ts, diagnostics is an exported function.
                // Bun.test spyOn might work if we import the module object.

                const originalDiagnostics = LSP.diagnostics
                // @ts-ignore
                LSP.diagnostics = async () => largeDiagnostics

                // Also mock LSP.touchFile to avoid actual file operations or errors
                const originalTouchFile = LSP.touchFile
                // @ts-ignore
                LSP.touchFile = async () => { }

                // Mock FileTime.assert to avoid read check
                const originalAssert = FileTime.assert
                // @ts-ignore
                FileTime.assert = async () => { }

                // Mock Bun.write to avoid actual file write
                const originalWrite = Bun.write
                // @ts-ignore
                Bun.write = async () => { }

                try {
                    const tool = await WriteTool.init()
                    const result = await tool.execute(
                        {
                            filePath: path.join(tmp.path, "test_file.ts"),
                            content: "console.log('hello')",
                        },
                        ctx,
                    )

                    expect(result.output.length).toBeLessThan(35000) // Should be around 30000 + overhead
                    expect(result.output).toContain("(Output was truncated due to length limit)")
                } finally {
                    // Restore mocks
                    // @ts-ignore
                    LSP.diagnostics = originalDiagnostics
                    // @ts-ignore
                    LSP.touchFile = originalTouchFile
                    // @ts-ignore
                    FileTime.assert = originalAssert
                    // @ts-ignore
                    Bun.write = originalWrite
                }
            },
        })
    })
})
