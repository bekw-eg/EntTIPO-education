import { localizedJson } from "@/lib/i18n/http";
import { prisma } from '@/lib/prisma'
import { getCurrentUserId, unauthorizedResponse } from '@/lib/user'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const userId = getCurrentUserId(request)
    if (!userId) return unauthorizedResponse(request)
    const topics = await prisma.topic.findMany({
      include: {
        progress: {
          where: { userId }
        }
      }
    })

    const progressData = topics.map(topic => ({
      topicId: topic.id,
      topicName: topic.name,
      masteryScore: topic.progress[0]?.masteryScore ?? 0,
      currentLevel: topic.progress[0]?.currentLevel ?? 1,
    }))

    return localizedJson(request, progressData)
  } catch (error) {
    console.error('Error in GET /api/progress:', error)
    return localizedJson(request, { error: 'Internal server error' }, { status: 500 })
  }
}
