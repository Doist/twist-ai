import { type Attachment } from '@doist/twist-sdk'

export type { Attachment }

/**
 * Separator between an attachment's label and its URL in the formatted text line.
 * Kept in one place so the rendering logic below stays in sync with itself.
 */
const URL_SEPARATOR = ' — '

/**
 * Coerce a raw `attachments` value from the Twist API into a list of attachment
 * objects, dropping anything that isn't a plain object. Returns `undefined` when
 * there are no attachments so callers can omit the field entirely.
 *
 * Note: an attachment's `url` points at `files.twist.com/...` and currently
 * requires a browser session cookie to download — there is no OAuth-authenticated
 * attachment download endpoint on the public Twist REST API today.
 */
export function normalizeAttachments(value: unknown): Attachment[] | undefined {
    if (!Array.isArray(value) || value.length === 0) {
        return undefined
    }
    return value.filter(
        (item): item is Attachment =>
            typeof item === 'object' && item !== null && !Array.isArray(item),
    )
}

/**
 * Render a one-line `**Attachments (n):** ...` summary, or `undefined` when there
 * are none. Each attachment shows its name (falling back to title), an optional
 * byte size, and its URL.
 */
export function formatAttachmentsLine(attachments: Attachment[] | undefined): string | undefined {
    if (!attachments || attachments.length === 0) {
        return undefined
    }
    const items = attachments
        .map((a) => {
            const name = a.fileName ?? a.title ?? undefined
            const size = typeof a.fileSize === 'number' ? ` (${a.fileSize} bytes)` : ''
            const url = a.url ?? undefined
            if (name) {
                return url ? `${name}${size}${URL_SEPARATOR}${url}` : `${name}${size}`
            }
            return url ?? '(unnamed attachment)'
        })
        .join('; ')
    return `**Attachments (${attachments.length}):** ${items}`
}
