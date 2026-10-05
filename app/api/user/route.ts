import { localizedJson } from "@/lib/i18n/http";
import { prisma } from '@/lib/prisma'
import { getCurrentUserId, unauthorizedResponse } from '@/lib/user'
import { z, ZodError } from 'zod'
import { validTimeZone } from '@/lib/learningPolicy'
import { lockAccount } from '@/lib/practiceStorage'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const userId = getCurrentUserId(request)
    if (!userId) return unauthorizedResponse(request)
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

    if (!user) return localizedJson(request, { error: 'User not found' }, { status: 404 })

    const { password, ...profile } = user
    return localizedJson(request, profile)
  } catch (error) {
    console.error('Error in GET /api/user:', error)
    return localizedJson(request, { error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const userId = getCurrentUserId(request)
  if (!userId) return unauthorizedResponse(request)
  try {
    const data = z.object({ timeZone: z.string().max(100).refine(validTimeZone) }).strict().parse(await request.json())
    return localizedJson(request, await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId)
      return tx.user.update({ where: { id: userId }, data, select: { id: true, timeZone: true } })
    }))
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return localizedJson(request, { error: 'Invalid time zone' }, { status: 400 })
    console.error('Could not save time zone', error)
    return localizedJson(request, { error: 'Could not save time zone' }, { status: 500 })
  }
}
