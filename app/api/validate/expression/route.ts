import { NextResponse } from 'next/server'
import { validateExpression } from '@/services/sympy'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userExpression, expectedExpression, variables } = body
    
    if (!userExpression || !expectedExpression) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    
    const result = await validateExpression(userExpression, expectedExpression, variables || [])
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in POST /api/validate/expression:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
