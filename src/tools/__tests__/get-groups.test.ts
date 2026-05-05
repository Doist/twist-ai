import type { Group, TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    extractStructuredContent,
    extractTextContent,
    TEST_ERRORS,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { getGroups } from '../get-groups.js'

const mockTwistApi = {
    groups: {
        getGroups: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { GET_GROUPS } = ToolNames

const createMockGroup = (overrides: Partial<Group> = {}): Group => ({
    id: 100,
    name: 'Product Automation',
    description: 'Automation recipients',
    workspaceId: TEST_IDS.WORKSPACE_1,
    userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
    version: 1,
    ...overrides,
})

describe(`${GET_GROUPS} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('fetching groups', () => {
        it('should fetch all workspace groups by default', async () => {
            const mockGroups = [
                createMockGroup(),
                createMockGroup({
                    id: 200,
                    name: 'Engineering',
                    description: null,
                    userIds: [TEST_IDS.USER_3],
                }),
            ]

            mockTwistApi.groups.getGroups.mockResolvedValue(mockGroups)

            const result = await getGroups.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            expect(mockTwistApi.groups.getGroups).toHaveBeenCalledWith(TEST_IDS.WORKSPACE_1)

            const textContent = extractTextContent(result)
            expect(textContent).toContain(`**Workspace ID:** ${TEST_IDS.WORKSPACE_1}`)
            expect(textContent).toContain('**Total Groups:** 2')
            expect(textContent).toContain('## Product Automation')
            expect(textContent).toContain('## Engineering')
            expect(textContent).toContain('**Members:** 2')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent).toEqual({
                type: 'get_groups',
                workspaceId: TEST_IDS.WORKSPACE_1,
                totalGroups: 2,
                filteredGroups: 2,
                groups: expect.arrayContaining([
                    expect.objectContaining({
                        id: 100,
                        name: 'Product Automation',
                        description: 'Automation recipients',
                        userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
                        memberCount: 2,
                    }),
                    expect.objectContaining({
                        id: 200,
                        name: 'Engineering',
                        userIds: [TEST_IDS.USER_3],
                        memberCount: 1,
                    }),
                ]),
            })
        })

        it('should handle empty groupIds array by fetching all groups', async () => {
            mockTwistApi.groups.getGroups.mockResolvedValue([createMockGroup()])

            const result = await getGroups.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, groupIds: [] },
                mockTwistApi,
            )

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.groups).toHaveLength(1)
        })
    })

    describe('filtering groups', () => {
        it('should filter groups by ID', async () => {
            const mockGroups = [
                createMockGroup({ id: 100, name: 'Product Automation' }),
                createMockGroup({ id: 200, name: 'Engineering' }),
                createMockGroup({ id: 300, name: 'Marketing' }),
            ]

            mockTwistApi.groups.getGroups.mockResolvedValue(mockGroups)

            const result = await getGroups.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, groupIds: [100, 300] },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Total Groups:** 2')
            expect(textContent).toContain('## Product Automation')
            expect(textContent).toContain('## Marketing')
            expect(textContent).not.toContain('## Engineering')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.totalGroups).toBe(2)
            expect(structuredContent.groups).toHaveLength(2)
        })

        it('should filter groups by name search case-insensitively', async () => {
            const mockGroups = [
                createMockGroup({ id: 100, name: 'Product Automation' }),
                createMockGroup({ id: 200, name: 'Engineering' }),
                createMockGroup({ id: 300, name: 'Automation QA' }),
            ]

            mockTwistApi.groups.getGroups.mockResolvedValue(mockGroups)

            const result = await getGroups.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, searchText: 'AUTOMATION' },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Total Groups:** 3 (2 matching search)')
            expect(textContent).toContain('## Product Automation')
            expect(textContent).toContain('## Automation QA')
            expect(textContent).not.toContain('## Engineering')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.totalGroups).toBe(3)
            expect(structuredContent.filteredGroups).toBe(2)
            expect(structuredContent.groups).toHaveLength(2)
        })

        it('should combine ID and search filters', async () => {
            const mockGroups = [
                createMockGroup({ id: 100, name: 'Product Automation' }),
                createMockGroup({ id: 200, name: 'Engineering Automation' }),
                createMockGroup({ id: 300, name: 'Marketing' }),
            ]

            mockTwistApi.groups.getGroups.mockResolvedValue(mockGroups)

            const result = await getGroups.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, groupIds: [100, 300], searchText: 'auto' },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Total Groups:** 2 (1 matching search)')
            expect(textContent).toContain('## Product Automation')
            expect(textContent).not.toContain('## Engineering Automation')
            expect(textContent).not.toContain('## Marketing')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.totalGroups).toBe(2)
            expect(structuredContent.filteredGroups).toBe(1)
            expect(structuredContent.groups).toHaveLength(1)
        })

        it('should handle no matching groups', async () => {
            mockTwistApi.groups.getGroups.mockResolvedValue([createMockGroup()])

            const result = await getGroups.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, searchText: 'nonexistent' },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Total Groups:** 1 (0 matching search)')
            expect(textContent).toContain('No groups found.')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.totalGroups).toBe(1)
            expect(structuredContent.filteredGroups).toBe(0)
            expect(structuredContent.groups).toHaveLength(0)
        })
    })

    describe('edge cases', () => {
        it('should handle empty group list', async () => {
            mockTwistApi.groups.getGroups.mockResolvedValue([])

            const result = await getGroups.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Total Groups:** 0')
            expect(textContent).toContain('No groups found.')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.groups).toHaveLength(0)
        })
    })

    describe('error handling', () => {
        it('should propagate API errors', async () => {
            const apiError = new Error(TEST_ERRORS.API_UNAUTHORIZED)
            mockTwistApi.groups.getGroups.mockRejectedValue(apiError)

            await expect(
                getGroups.execute({ workspaceId: TEST_IDS.WORKSPACE_1 }, mockTwistApi),
            ).rejects.toThrow(TEST_ERRORS.API_UNAUTHORIZED)
        })
    })
})
