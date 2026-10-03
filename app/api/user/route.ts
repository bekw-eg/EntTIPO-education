import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId, unauthorizedResponse } from '@/lib/user'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const userId = getCurrentUserId(request)
    if (!userId) return unauthorizedResponse()
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        topicProgress: {
          include: { topic: true },
          orderBy: { masteryScore: 'asc' }
        },
        dailyGoals: {
          where: {
            date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
          },
          take: 1
        }
      }
    })
    
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    
    const { password, ...profile } = user
    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error in GET /api/user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
