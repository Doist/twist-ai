import type { TwistApi } from '@doist/twist-sdk'
import type { z } from 'zod'
import type { RequiredToolAnnotations } from './utils/required-tool-annotations.js'

/**
 * A Twist tool that can be used in an MCP server or other conversational AI interfaces.
 */
type TwistTool<Params extends z.ZodRawShape, Output extends z.ZodRawShape = z.ZodRawShape> = {
    /**
     * The name of the tool.
     */
    name: string

    /**
     * The description of the tool. This is important for the LLM to understand what the tool does,
     * and how to use it.
     */
    description: string

    /**
     * The schema of the parameters of the tool.
     *
     * This is used to validate the parameters of the tool, as well as to let the LLM know what the
     * parameters are.
     */
    parameters: Params

    /**
     * The schema of the output of the tool.
     *
     * This is used to validate the output of the tool, as well as to let MCP clients know what the
     * structure of the returned data will be.
     */
    outputSchema: Output

    /**
     * MCP ToolAnnotations hints for this tool.
     *
     * Common defaults (e.g. title, openWorldHint) are applied when registering.
     */
    annotations: RequiredToolAnnotations

    /**
     * The function that executes the tool.
     *
     * This is the main function that will be called when the tool is used.
     *
     * @param args - The arguments of the tool.
     * @param client - The Twist API client used to make requests to the Twist API.
     * @returns The result of the tool.
     */
    execute: (args: z.infer<z.ZodObject<Params>>, client: TwistApi) => Promise<unknown>
}

export type { TwistTool }
