import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/user'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = getCurrentUserId()
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

    return NextResponse.json(progressData)
  } catch (error) {
    console.error('Error in GET /api/progress:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
