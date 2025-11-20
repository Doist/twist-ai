/**
 * Categorization of tool behavior for MCP annotation hints.
 *
 * - **readonly**: Tool only reads data, doesn't modify state (e.g., get-*, search-*, load-*)
 * - **additive**: Tool creates new resources but doesn't modify existing ones (e.g., reply, react)
 * - **mutating**: Tool modifies or destroys existing data (e.g., mark-done)
 */
export type ToolMutability = 'readonly' | 'additive' | 'mutating'

/**
 * Convert tool mutability level to MCP annotation hints.
 *
 * @param mutability - The mutability level of the tool.
 * @returns MCP annotations with readOnlyHint and destructiveHint set appropriately.
 */
export function getMcpAnnotations(mutability: ToolMutability) {
    switch (mutability) {
        case 'readonly':
            return { readOnlyHint: true, destructiveHint: false }
        case 'additive':
            return { readOnlyHint: false, destructiveHint: false }
        case 'mutating':
            return { readOnlyHint: false, destructiveHint: true }
    }
}