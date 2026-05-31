import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { uploadAttachments } from '../attachments.js'

// The client only needs the runtime auth fields the helper reads off it.
function makeClient(overrides: Record<string, unknown> = {}): TwistApi {
    return { authToken: 'oauth2:test-token', ...overrides } as unknown as TwistApi
}

function mockUploadResponse(attachment: Record<string, unknown>) {
    return {
        ok: true,
        status: 200,
        json: async () => attachment,
        text: async () => JSON.stringify(attachment),
    } as unknown as Response
}

describe('uploadAttachments', () => {
    let tmpDir: string
    const originalFetch = globalThis.fetch

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), 'twist-attach-'))
    })

    afterEach(async () => {
        globalThis.fetch = originalFetch
        await rm(tmpDir, { recursive: true, force: true })
    })

    it('returns an empty array without calling fetch when no paths are given', async () => {
        const fetchMock = jest.fn<typeof fetch>()
        globalThis.fetch = fetchMock

        const result = await uploadAttachments(makeClient(), [])

        expect(result).toEqual([])
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('uploads a file and returns the attachment object from the response', async () => {
        const filePath = join(tmpDir, 'report.txt')
        await writeFile(filePath, 'hello world')

        const attachment = { attachmentId: 'abc-123', fileName: 'report.txt', urlType: 'file' }
        const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(mockUploadResponse(attachment))
        globalThis.fetch = fetchMock

        const result = await uploadAttachments(makeClient(), [filePath])

        expect(result).toEqual([attachment])
        expect(fetchMock).toHaveBeenCalledTimes(1)

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toBe('https://api.twist.com/api/v3/attachments/upload')
        expect(init.method).toBe('POST')
        expect((init.headers as Record<string, string>).Authorization).toBe(
            'Bearer oauth2:test-token',
        )

        const body = init.body as FormData
        expect(body).toBeInstanceOf(FormData)
        expect(typeof body.get('attachment_id')).toBe('string')
        const filePart = body.get('file_name') as File
        expect(filePart).toBeInstanceOf(Blob)
        expect((filePart as File).name).toBe('report.txt')
    })

    it('uploads multiple files preserving input order in the result', async () => {
        const a = join(tmpDir, 'a.txt')
        const b = join(tmpDir, 'b.txt')
        await writeFile(a, 'A')
        await writeFile(b, 'B')

        // Uploads run concurrently, so key the response off the file name in the form data
        // rather than call order. The result array must still follow the input order.
        const fetchMock = jest.fn<typeof fetch>().mockImplementation(async (_url, init) => {
            const form = (init as RequestInit).body as FormData
            const name = (form.get('file_name') as File).name
            return mockUploadResponse({ attachmentId: `id-${name}`, fileName: name })
        })
        globalThis.fetch = fetchMock

        const result = await uploadAttachments(makeClient(), [a, b])

        expect(result).toEqual([
            { attachmentId: 'id-a.txt', fileName: 'a.txt' },
            { attachmentId: 'id-b.txt', fileName: 'b.txt' },
        ])
    })

    it('uses a custom base URL when the client has one', async () => {
        const filePath = join(tmpDir, 'c.txt')
        await writeFile(filePath, 'C')

        const fetchMock = jest
            .fn<typeof fetch>()
            .mockResolvedValue(mockUploadResponse({ attachmentId: 'id-c' }))
        globalThis.fetch = fetchMock

        await uploadAttachments(makeClient({ baseUrl: 'https://twist.example.com' }), [filePath])

        const [url] = fetchMock.mock.calls[0] as [string]
        expect(url).toBe('https://twist.example.com/api/v3/attachments/upload')
    })

    it('throws a clear error when the file does not exist', async () => {
        const fetchMock = jest.fn<typeof fetch>()
        globalThis.fetch = fetchMock

        await expect(
            uploadAttachments(makeClient(), [join(tmpDir, 'missing.txt')]),
        ).rejects.toThrow('Attachment file not found or unreadable')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('throws when the upload endpoint returns a non-OK status', async () => {
        const filePath = join(tmpDir, 'd.txt')
        await writeFile(filePath, 'D')

        const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
            ok: false,
            status: 413,
            text: async () => 'File too large',
            json: async () => ({}),
        } as unknown as Response)
        globalThis.fetch = fetchMock

        await expect(uploadAttachments(makeClient(), [filePath])).rejects.toThrow(
            'Failed to upload attachment "d.txt" (HTTP 413): File too large',
        )
    })

    it('throws when the client has no auth token', async () => {
        const filePath = join(tmpDir, 'e.txt')
        await writeFile(filePath, 'E')

        await expect(
            uploadAttachments(makeClient({ authToken: undefined }), [filePath]),
        ).rejects.toThrow('missing an auth token')
    })
})
