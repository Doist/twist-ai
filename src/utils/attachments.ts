import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { Attachment, TwistApi } from '@doist/twist-sdk'

/**
 * The Twist API version used for direct (non-SDK) calls. The SDK has no attachment-upload
 * method, so we POST to the upload endpoint ourselves and reuse the same versioned base path.
 */
const API_VERSION = 'v3'
const DEFAULT_DOMAIN = 'https://api.twist.com'

/**
 * Runtime shape of the auth fields carried by a {@link TwistApi} instance.
 *
 * `authToken` and `baseUrl` are declared `private` on the SDK's `TwistApi` class, but they
 * exist as plain instance properties at runtime (the SDK reads `this.authToken` /
 * `this.baseUrl` when building requests). We read them here to upload attachments through the
 * same credentials the client already uses, without changing the tool contract.
 */
type TwistAuthConfig = {
    authToken: string
    baseUrl?: string
}

function getAuthConfig(client: TwistApi): TwistAuthConfig {
    const { authToken, baseUrl } = client as unknown as TwistAuthConfig
    if (!authToken) {
        throw new Error('Twist client is missing an auth token; cannot upload attachments.')
    }
    return { authToken, baseUrl }
}

/**
 * Builds the versioned API base URI, mirroring the SDK's BaseClient.getBaseUri():
 * custom base URLs get `/api/<version>/` appended, otherwise the default Twist domain is used.
 */
function getApiBaseUri(baseUrl?: string): string {
    const domain = baseUrl && baseUrl.length > 0 ? baseUrl : DEFAULT_DOMAIN
    const normalized = domain.endsWith('/') ? domain : `${domain}/`
    return `${normalized}api/${API_VERSION}/`
}

async function uploadOne(filePath: string, config: TwistAuthConfig): Promise<Attachment> {
    let fileBuffer: Buffer
    try {
        fileBuffer = await readFile(filePath)
    } catch {
        throw new Error(`Attachment file not found or unreadable: ${filePath}`)
    }

    const fileName = basename(filePath)

    // Multipart fields per the Twist API "Add attachment" docs:
    //   POST https://api.twist.com/api/v3/attachments/upload
    //   -F attachment_id=$(uuidgen) -F file_name=@<file>
    // The binary file is sent in the field literally named `file_name`; the response is an
    // attachment object that gets passed back into the `attachments` array of a message/comment.
    // See https://developer.twist.com/v3/#add-attachment
    const form = new FormData()
    form.append('attachment_id', randomUUID())
    form.append('file_name', new Blob([new Uint8Array(fileBuffer)]), fileName)

    const url = `${getApiBaseUri(config.baseUrl)}attachments/upload`
    const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.authToken}` },
        body: form,
    })

    if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(
            `Failed to upload attachment "${fileName}" (HTTP ${response.status})${
                body ? `: ${body}` : ''
            }`,
        )
    }

    // The upload endpoint returns the attachment object in the Twist API's snake_case shape.
    // The SDK re-serializes request bodies to snake_case before sending, so we hand the raw
    // object straight through; the SDK's Attachment type is `$loose` and tolerates the extra
    // fields the upload endpoint returns.
    return (await response.json()) as Attachment
}

/**
 * Uploads one or more local files to Twist and returns the resulting attachment objects,
 * ready to pass into the `attachments` array of createMessage / createComment.
 *
 * @param client - The Twist API client (used for its auth token and base URL).
 * @param filePaths - Absolute or relative local filesystem paths to upload.
 * @returns The uploaded attachment objects, in the same order as `filePaths`.
 */
async function uploadAttachments(client: TwistApi, filePaths: string[]): Promise<Attachment[]> {
    if (filePaths.length === 0) {
        return []
    }
    const config = getAuthConfig(client)
    const uploads = await Promise.all(filePaths.map((path) => uploadOne(path, config)))
    return uploads
}

export { uploadAttachments }
