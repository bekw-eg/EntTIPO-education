import type { ExamProfile } from './profile';
import type { ExamCandidate } from './readiness';

/** Exact upper capacity for this platform's one-task-per-point blueprint.
 * Families may recur across papers, never within one paper: each family belongs
 * to one point. Integral point/band flow can be decomposed into balanced papers.
 * This is a planning maximum; random online selections can exhaust earlier. */
export function nonRepeatingCapacity(profile: ExamProfile, candidates: ExamCandidate[]) {
  if (profile.points.length !== profile.official.questionCount) throw new Error('Capacity requires one task per point');
  const unique = [...new Map(candidates.map(q=>[q.mathKey??q.contentHash,q])).values()];
  const bands = ['A','B','C'] as const;
  const upper = Math.min(...profile.points.map(p=>unique.filter(q=>q.pointCode===p.code).length));
  function feasible(n:number) {
    const edges = new Map<string,Map<string,number>>();
    function add(a:string,b:string,c:number) {
      if (!edges.has(a)) edges.set(a,new Map());
      if (!edges.has(b)) edges.set(b,new Map());
      edges.get(a)!.set(b,c);edges.get(b)!.set(a,0);
    }
    for(const point of profile.points) {
      add('source',point.code,n);
      for(const band of bands) add(point.code,band,unique.filter(q=>q.pointCode===point.code&&q.band===band).length);
    }
    for(const band of bands) add(band,'sink',profile.official.difficultyCounts[band]*n);
    let flow=0;
    for(;;) {
      const parents=new Map<string,string>(),queue=['source'];
      for(let i=0;i<queue.length&&!parents.has('sink');i++) {
        for(const [next,capacity] of edges.get(queue[i])??[]) if(capacity>0&&next!=='source'&&!parents.has(next)) {
          parents.set(next,queue[i]);queue.push(next);
        }
      }
      if(!parents.has('sink')) break;
      let amount=Infinity;
      for(let at='sink';at!=='source';at=parents.get(at)!) amount=Math.min(amount,edges.get(parents.get(at)!)!.get(at)!);
      for(let at='sink';at!=='source';at=parents.get(at)!) {
        const prev=parents.get(at)!;
        edges.get(prev)!.set(at,edges.get(prev)!.get(at)!-amount);
        edges.get(at)!.set(prev,edges.get(at)!.get(prev)!+amount);
      }
      flow+=amount;
    }
    return flow===n*profile.official.questionCount;
  }
  let lo=0,hi=upper;
  while(lo<hi) { const mid=Math.ceil((lo+hi)/2); if(feasible(mid)) lo=mid; else hi=mid-1; }
  return { maximumPapers:lo,topicUpperBound:upper };
}
