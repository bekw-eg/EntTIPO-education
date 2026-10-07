import assert from "node:assert/strict";
import { choiceFixture, api, prisma, submission } from "./choice_test_fixture";
import { localDay } from "../lib/learningPolicy";
import { parseChoice } from "../lib/practiceChoice";
import type { LearningRoadView } from "../lib/learning-road/types";

export async function roadFixture() {
  const fixture = await choiceFixture();
  await prisma.skillObservation.createMany({ data: [0, 1, 2].map(index => ({
    userId: fixture.a.id, skillId: fixture.skill.id, questionId: fixture.q(index), score: 0,
    isCorrect: false, isPartial: false, usedHint: false, difficulty: 1, attemptNumber: 1,
  })) });
  await prisma.skillReview.create({ data: { userId: fixture.a.id, skillId: fixture.skill.id,
    dueDay: localDay(new Date(), "Asia/Qyzylorda"), timeZone: "Asia/Qyzylorda" } });
  return fixture;
}
export async function road(cookie: string): Promise<LearningRoadView> {
  const response = await api("/api/learning-road", cookie);
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.match(response.response.headers.get("cache-control") ?? "", /no-store/);
  return response.data;
}
export async function startNode(cookie: string, nodeId: string) {
  const result = await api("/api/learning-road", cookie, "POST", { action: "start", nodeId });
  assert.equal(result.status, 200, JSON.stringify(result.data)); return result.data;
}
export async function completeSession(cookie: string, sessionId: string) {
  let state = (await api(`/api/sessions/${sessionId}`, cookie)).data;
  while (state.status !== "completed") {
    if (!state.result) {
      const q = await prisma.question.findUniqueOrThrow({ where: { id: state.question.id } });
      const choice = parseChoice(q.practiceChoice);
      const response = await api("/api/attempts", cookie, "POST", submission(sessionId, q.id, choice.correctOptionIds[0]));
      assert.equal(response.status, 200, JSON.stringify(response.data));
      state = (await api(`/api/sessions/${sessionId}`, cookie)).data;
    }
    const response = await api(`/api/sessions/${sessionId}/state`, cookie, "PATCH", { action: "next", revision: state.revision });
    assert.equal(response.status, 200, JSON.stringify(response.data)); state = response.data;
  }
}
