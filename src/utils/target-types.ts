import { z } from 'zod'

/**
 * Valid Twist object types that can be used in enums
 */
type TwistObjectType = 'thread' | 'comment' | 'message' | 'conversation' | 'workspace'

/**
 * Helper to create an enum schema with types.
 * Requires at least 2 values (Zod enum requirement).
 * Only allows valid Twist object types.
 */
function createEnumSchema<const T extends readonly [TwistObjectType, TwistObjectType, ...TwistObjectType[]]>(
    values: T,
) {
    return {
        values,
        schema: z.enum(values),
    } as const
}

/**
 * Target types for reactions
 */
export const ReactionTargetType = createEnumSchema(['thread', 'comment', 'message'])
export const ReactionTargetTypeSchema = ReactionTargetType.schema
export type ReactionTargetType = z.infer<typeof ReactionTargetTypeSchema>

/**
 * Target types for replies
 */
export const ReplyTargetType = createEnumSchema(['thread', 'conversation'])
export const ReplyTargetTypeSchema = ReplyTargetType.schema
export type ReplyTargetType = z.infer<typeof ReplyTargetTypeSchema>

/**
 * Search scope types
 */
export const SearchScope = createEnumSchema(['workspace', 'thread', 'conversation'])
export const SearchScopeSchema = SearchScope.schema
export type SearchScope = z.infer<typeof SearchScopeSchema>

/**
 * Mark done types
 */
export const MarkDoneType = createEnumSchema(['thread', 'conversation'])
export const MarkDoneTypeSchema = MarkDoneType.schema
export type MarkDoneType = z.infer<typeof MarkDoneTypeSchema>
