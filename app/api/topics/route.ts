import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId, unauthorizedResponse } from '@/lib/user'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const userId = getCurrentUserId(request)
    if (!userId) return unauthorizedResponse()
    const topics = await prisma.topic.findMany({
      orderBy: { order: 'asc' },
      include: {
        lesson: true,
        progress: {
          where: { userId }
        },
        _count: { select: { questions: true } }
      }
    })

    const topicsWithProgress = topics.map(topic => ({
      ...topic,
      masteryScore: topic.progress[0]?.masteryScore ?? 0,
    }))

    return NextResponse.json(topicsWithProgress)
  } catch (error) {
    console.error('Error in GET /api/topics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
