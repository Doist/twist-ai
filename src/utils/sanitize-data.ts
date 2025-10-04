/**
 * Recursively remove null fields from an object.
 * @param obj - The object to sanitize.
 * @returns The sanitized object.
 */
function removeNullFields<T extends Record<string, unknown>>(obj: T): T {
    const result = {} as T

    for (const key in obj) {
        const value = obj[key]
        if (value === null || value === undefined) {
            continue
        }

        if (typeof value === 'object' && !Array.isArray(value)) {
            result[key] = removeNullFields(value as Record<string, unknown>) as T[Extract<
                keyof T,
                string
            >]
        } else if (Array.isArray(value)) {
            result[key] = value.map((item) =>
                typeof item === 'object' && item !== null ? removeNullFields(item) : item,
            ) as T[Extract<keyof T, string>]
        } else {
            result[key] = value
        }
    }

    return result
}

export { removeNullFields }
