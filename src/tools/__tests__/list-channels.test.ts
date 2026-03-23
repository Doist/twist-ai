import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    extractStructuredContent,
    extractTextContent,
    TEST_ERRORS,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { listChannels } from '../list-channels.js'

const mockTwistApi = {
    channels: {
        getChannels: jest.fn(),
    },
    workspaceUsers: {
        getUserById: jest.fn(),
    },
    batch: jest.fn(),
} as unknown as jest.Mocked<TwistApi>

const { LIST_CHANNELS } = ToolNames

const createMockChannel = (overrides = {}) => ({
    id: TEST_IDS.CHANNEL_1,
    name: 'General',
    creator: TEST_IDS.USER_1,
    public: true,
    workspaceId: TEST_IDS.WORKSPACE_1,
    archived: false,
    created: new Date('2024-01-01T00:00:00Z'),
    version: 1,
    ...overrides,
})

describe(`${LIST_CHANNELS} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockTwistApi.batch.mockImplementation(async (...args: readonly unknown[]) => {
            const results = []
            for (const arg of args) {
                const result = await arg
                results.push({ data: result })
            }
            return results as never
        })
    })

    describe('listing channels', () => {
        it('should list all channels in a workspace', async () => {
            const mockChannels = [
                createMockChannel(),
                createMockChannel({
                    id: 67891,
                    name: 'Engineering',
                    public: false,
                    creator: TEST_IDS.USER_2,
                }),
            ]

            mockTwistApi.channels.getChannels.mockResolvedValue(mockChannels)
            mockTwistApi.workspaceUsers.getUserById.mockImplementation(
                async (args: { workspaceId: number; userId: number }) => {
                    if (args.userId === TEST_IDS.USER_1) {
                        return { name: 'Alice Johnson' }
                    }
                    if (args.userId === TEST_IDS.USER_2) {
                        return { name: 'Bob Smith' }
                    }
                    throw new Error('User not found')
                },
            )

            const result = await listChannels.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            expect(mockTwistApi.channels.getChannels).toHaveBeenCalledWith({
                workspaceId: TEST_IDS.WORKSPACE_1,
            })

            const textContent = extractTextContent(result)
            expect(textContent).toContain('Found 2 channels')
            expect(textContent).toContain('## [General]')
            expect(textContent).toContain('## [Engineering]')
            expect(textContent).toContain('**Public:** Yes')
            expect(textContent).toContain('**Public:** No')
            expect(textContent).toContain('Alice Johnson')
            expect(textContent).toContain('Bob Smith')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent).toEqual({
                type: 'list_channels',
                workspaceId: TEST_IDS.WORKSPACE_1,
                totalChannels: 2,
                channels: expect.arrayContaining([
                    expect.objectContaining({
                        id: TEST_IDS.CHANNEL_1,
                        name: 'General',
                        public: true,
                        archived: false,
                        creatorId: TEST_IDS.USER_1,
                        creatorName: 'Alice Johnson',
                    }),
                    expect.objectContaining({
                        id: 67891,
                        name: 'Engineering',
                        public: false,
                        creatorId: TEST_IDS.USER_2,
                        creatorName: 'Bob Smith',
                    }),
                ]),
            })
        })

        it('should handle empty channel list', async () => {
            mockTwistApi.channels.getChannels.mockResolvedValue([])

            const result = await listChannels.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('No channels found.')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent).toEqual({
                type: 'list_channels',
                workspaceId: TEST_IDS.WORKSPACE_1,
                channels: [],
                totalChannels: 0,
            })
        })

        it('should handle single channel', async () => {
            mockTwistApi.channels.getChannels.mockResolvedValue([createMockChannel()])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice Johnson' })

            const result = await listChannels.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('Found 1 channel in')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.totalChannels).toBe(1)
        })
    })

    describe('channel details', () => {
        it('should include description when present', async () => {
            mockTwistApi.channels.getChannels.mockResolvedValue([
                createMockChannel({ description: 'Main discussion channel' }),
            ])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listChannels.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Description:** Main discussion channel')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.channels[0]).toHaveProperty(
                'description',
                'Main discussion channel',
            )
        })

        it('should omit description when not present', async () => {
            mockTwistApi.channels.getChannels.mockResolvedValue([createMockChannel()])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listChannels.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).not.toContain('**Description:**')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.channels[0]).not.toHaveProperty('description')
        })

        it('should show archived status', async () => {
            mockTwistApi.channels.getChannels.mockResolvedValue([
                createMockChannel({ archived: true }),
            ])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listChannels.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Archived:** Yes')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.channels[0].archived).toBe(true)
        })

        it('should include color when present', async () => {
            mockTwistApi.channels.getChannels.mockResolvedValue([createMockChannel({ color: 5 })])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listChannels.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.channels[0]).toHaveProperty('color', 5)
        })

        it('should omit color when not present', async () => {
            mockTwistApi.channels.getChannels.mockResolvedValue([createMockChannel()])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listChannels.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.channels[0]).not.toHaveProperty('color')
        })
    })

    describe('creator resolution', () => {
        it('should batch-fetch creator names', async () => {
            const mockChannels = [
                createMockChannel({ creator: TEST_IDS.USER_1 }),
                createMockChannel({ id: 67891, name: 'Other', creator: TEST_IDS.USER_1 }),
                createMockChannel({ id: 67892, name: 'Third', creator: TEST_IDS.USER_2 }),
            ]

            mockTwistApi.channels.getChannels.mockResolvedValue(mockChannels)
            mockTwistApi.workspaceUsers.getUserById.mockImplementation(
                async (args: { workspaceId: number; userId: number }) => {
                    if (args.userId === TEST_IDS.USER_1) return { name: 'Alice' }
                    if (args.userId === TEST_IDS.USER_2) return { name: 'Bob' }
                    throw new Error('User not found')
                },
            )

            await listChannels.execute({ workspaceId: TEST_IDS.WORKSPACE_1 }, mockTwistApi)

            // Should only batch 2 unique creators, not 3
            expect(mockTwistApi.batch).toHaveBeenCalledTimes(1)
        })

        it('should handle missing creator gracefully', async () => {
            mockTwistApi.channels.getChannels.mockResolvedValue([createMockChannel()])
            mockTwistApi.batch.mockResolvedValue([{ data: undefined }] as never)

            const result = await listChannels.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            // Should fall back to showing creator ID
            expect(textContent).toContain(`**Creator:** ${TEST_IDS.USER_1}`)

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.channels[0]).not.toHaveProperty('creatorName')
        })
    })

    describe('includeArchived', () => {
        it('should only fetch active channels by default', async () => {
            mockTwistApi.channels.getChannels.mockResolvedValue([createMockChannel()])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            await listChannels.execute({ workspaceId: TEST_IDS.WORKSPACE_1 }, mockTwistApi)

            expect(mockTwistApi.channels.getChannels).toHaveBeenCalledTimes(1)
            expect(mockTwistApi.channels.getChannels).toHaveBeenCalledWith({
                workspaceId: TEST_IDS.WORKSPACE_1,
            })
        })

        it('should batch-fetch active and archived channels when includeArchived is true', async () => {
            const activeChannel = createMockChannel({ name: 'Active' })
            const archivedChannel = createMockChannel({
                id: 67891,
                name: 'Archived',
                archived: true,
                creator: TEST_IDS.USER_1,
            })

            mockTwistApi.channels.getChannels.mockImplementation(async (args) => {
                if ('archived' in args && args.archived === true) {
                    return [archivedChannel]
                }
                return [activeChannel]
            })
            mockTwistApi.batch.mockResolvedValue([
                { data: [activeChannel] },
                { data: [archivedChannel] },
            ] as never)
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listChannels.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, includeArchived: true },
                mockTwistApi,
            )

            // Should use batch for the two getChannels calls
            expect(mockTwistApi.batch).toHaveBeenCalled()

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.totalChannels).toBe(2)
            expect(structuredContent.channels).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Active', archived: false }),
                    expect.objectContaining({ name: 'Archived', archived: true }),
                ]),
            )
        })
    })

    describe('error handling', () => {
        it('should propagate API errors', async () => {
            const apiError = new Error(TEST_ERRORS.API_UNAUTHORIZED)
            mockTwistApi.channels.getChannels.mockRejectedValue(apiError)

            await expect(
                listChannels.execute({ workspaceId: TEST_IDS.WORKSPACE_1 }, mockTwistApi),
            ).rejects.toThrow(TEST_ERRORS.API_UNAUTHORIZED)
        })
    })
})
