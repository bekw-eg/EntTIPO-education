import { localizedJson } from "@/lib/i18n/http";
import { validateExpression } from '@/services/sympy'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userExpression, expectedExpression, variables } = body

    if (!userExpression || !expectedExpression) {
      return localizedJson(request, { error: 'Missing parameters' }, { status: 400 })
    }

    const result = await validateExpression(userExpression, expectedExpression, variables || [])
    return localizedJson(request, result)
  } catch (error) {
    console.error('Error in POST /api/validate/expression:', error)
    return localizedJson(request, { error: 'Internal server error' }, { status: 500 })
  }
}
