import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/user'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = getCurrentUserId()
    
    const [attempts, thirtyDaysAttempts, topicProgress] = await Promise.all([
      prisma.userAttempt.findMany({
        where: { userId },
        select: { createdAt: true, isCorrect: true }
      }),
      prisma.userAttempt.findMany({
        where: { 
          userId, 
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
        },
        select: { createdAt: true, isCorrect: true }
      }),
      prisma.userTopicProgress.findMany({
        where: { userId },
        include: { topic: true }
      })
    ])

    const totalSolved = attempts.length
    const correctCount = attempts.filter(a => a.isCorrect).length
    const overallAccuracy = totalSolved > 0 ? (correctCount / totalSolved) * 100 : 0
    
    const distinctDays = new Set(attempts.map(a => new Date(a.createdAt).toDateString()))
    const totalDays = distinctDays.size

    const byDate = new Map<string, { correct: number; total: number }>()
    thirtyDaysAttempts.forEach(a => {
      // Use YYYY-MM-DD format for stable sorting, or Russian locale as requested
      const dateStr = new Date(a.createdAt).toLocaleDateString('ru-RU')
      const existing = byDate.get(dateStr) ?? { correct: 0, total: 0 }
      existing.total++
      if (a.isCorrect) existing.correct++
      byDate.set(dateStr, existing)
    })

    const dailyAccuracy = Array.from(byDate.entries()).map(([date, data]) => ({
      date,
      accuracy: Math.round((data.correct / data.total) * 100),
      count: data.total
    })).sort((a, b) => {
      // Sorting by date string dd.mm.yyyy is tricky, let's just reverse or sort by parsed
      const [d1, m1, y1] = a.date.split('.')
      const [d2, m2, y2] = b.date.split('.')
      return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime()
    })

    const bestTopic = [...topicProgress].sort((a, b) => b.masteryScore - a.masteryScore)[0] || null
    const weakestTopic = [...topicProgress].sort((a, b) => a.masteryScore - b.masteryScore).find(t => t.masteryScore > 0) || null

    return NextResponse.json({
      overallAccuracy,
      totalSolved,
      totalDays,
      dailyAccuracy,
      topicProgress,
      bestTopic,
      weakestTopic
    })
  } catch (error) {
    console.error('Error in GET /api/statistics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
