import {stableHash} from './f8-stable-hash.js';
import {buildF8PlanProjection,buildF8ScenarioProjection} from './f8-binding.js';

const EPS=1e-9;
const fail=m=>{throw new Error(`U1B_ADAPTER: ${m}`)};
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const v of Object.values(x))freeze(v);Object.freeze(x)}return x};
const clone=x=>structuredClone(x);
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const hash=stableHash;
const finite=(v,label)=>{if(typeof v!=='number'||!Number.isFinite(v))fail(`${label} must be finite`);return v};
const nonneg=(v,label)=>{finite(v,label);if(v<-EPS)fail(`${label} must be nonnegative`);return Math.max(0,v)};

function assertResidualOnlyLiveProjection(p){
  if(p?.schemaVersion!=='F8_PROJECTION_V1'||p.status!=='WORKING_QA')fail('WORKING_QA F8_PROJECTION_V1 required');
  if(!String(p.sourceVersion??'').startsWith('F8_LIVE_PROJECTION_V1'))fail('live F8 projection provenance required');
  const rotation=Number(p.rotation?.R??p.selectedPlan?.rotationCapital??0);
  const long=Number(p.LONG?.q??p.selectedPlan?.longCapital??0);
  const qRows=Array.isArray(p.qualifyingTimeline)?p.qualifyingTimeline:[];
  const selectedQ=Number(p.selectedPlan?.qualifyingTransfers?.reduce?.((n,x)=>n+Number(x?.amount??x?.grossAmount??0),0)??0);
  if(Math.abs(rotation)>EPS||Math.abs(long)>EPS||qRows.length||Math.abs(selectedQ)>EPS)
    fail('positive R/Q/q live economics are not certified for U1B');
  finite(p.expectedFamilyValue,'expectedFamilyValue');
  finite(p.displayedScenarioValue,'displayedScenarioValue');
  finite(p.baselineWithoutPlanning?.familyValueAtMemberDeath,'baseline family value');
  if(!Array.isArray(p.originLots)||!Array.isArray(p.yearlyBalances)||!Array.isArray(p.FinalUses))fail('complete residual projection arrays required');
  return p;
}

function identityRequired(identity){
  if(!identity?.generation||!identity?.inputHash||!identity?.rulesVersion||!identity?.modelVersion)fail('complete projection identity required');
  return identity;
}

/**
 * Adapts the currently certified live residual-only F8 projection to the U1 PlanProjection contract.
 * It does not run any optimizer and refuses positive Rotation / Qualifying / LONG values.
 */
export function buildPlanProjectionFromLiveResidual({liveProjection,identity,constraints={},capabilities={},assumptions={},provenance={}}={}){
  const p=assertResidualOnlyLiveProjection(liveProjection),id=identityRequired(identity);
  const initialCapital=p.originLots.reduce((n,x)=>n+nonneg(Number(x.amount??0),'origin amount'),0);
  const residual=nonneg(Number(p.selectedPlan?.residualCapital??p.residualCapital??initialCapital),'residual capital');
  const planId=`plan:live-residual:${hash({inputHash:id.inputHash,sourceVersion:p.sourceVersion,origins:p.originLots.map(x=>({id:x.id,pathId:x.pathId,amount:x.amount,wrapper:x.wrapper,taxBasisNominal:x.taxBasisNominal,taxBasisReal:x.taxBasisReal})),strategy:p.selectedPlan?.strategy??'RESIDUAL_ONLY'}).slice(0,24)}`;
  const committed=freeze({
    schemaVersion:'F8_INTEGRATED_PLAN_DRAFT_V1',status:'COMMITTED_PLAN_SNAPSHOT',
    openingStateHash:hash({inputHash:id.inputHash,origins:p.originLots}),planId,
    winnerCandidateId:'LIVE_RESIDUAL_ONLY',baselineCandidateId:'LIVE_RESIDUAL_BASELINE',
    expectedNetFamilyValue:p.expectedFamilyValue,
    baselineExpectedNetFamilyValue:p.expectedFamilyValue,
    expectedDeltaVsBaseline:0,
    contractOptionId:null,serviceChoiceId:null,
    economicActions:[],
    optimizerActions:[{actionId:'live:residual',actionType:'RESIDUAL',amount:residual,sourceId:'LIVE_ORIGIN_SET',destinationId:'RESIDUAL_EXISTING_PRODUCTS',entryRoute:'STAY',reasonCode:'CURRENTLY_CERTIFIED_LIVE_PATH'}],
    capacityClaimsByScenario:[],rightsClaims:[],
    moduleEvidence:[{kind:'LIVE_RESIDUAL',sourceVersion:p.sourceVersion,provenance:clone(p.debug?.provenance??{})}],
    mortalityDependenceFragile:false,globalCertificate:'LIVE_RESIDUAL_PATH_BACKED',productionReady:false,
    blockedReasons:['POSITIVE_R_Q_q_LIVE_NOT_CERTIFIED','LIVE_EVENT_EXECUTION_NOT_BOUND']
  });
  const mergedCapabilities={
    residual:'SUPPORTED_VERIFIED',rotation:'BLOCKED',qualifying:'BLOCKED',longAnnuitization:'BLOCKED',
    ...capabilities
  };
  return buildF8PlanProjection({
    committedPlan:committed,identity:id,constraints,capabilities:mergedCapabilities,assumptions,
    provenance:{sourceAdapter:'U1B_LIVE_RESIDUAL_ADAPTER_V1',sourceVersion:p.sourceVersion,...provenance},
    sourceSummary:{
      initialCapital,residualCapital:residual,currentAge:p.currentAge??null,originLots:p.originLots.map(x=>clone(x)),excludedSources:clone(p.excludedSources??[]),
      openingState:{age:p.visualStages?.stage1?.currentAge??p.currentAge??null,capitalForPlanning:p.visualStages?.stage1?.initialCapital??initialCapital,products:p.originLots.map(x=>({productId:x.id,productType:x.wrapper,balance:x.amount}))},
      stage2:{buckets:{
        SAVINGS_POLICY:{closingBalance:p.visualStages?.stage2?.policyEndBalance??null},
        T190_RECOGNIZED:{closingBalance:p.visualStages?.stage2?.recognizedEndBalance??null},
        T190_QUALIFYING:{closingBalance:p.visualStages?.stage2?.qualifyingEndBalance??null}
      }},
      stage3:{status:'NOT_APPLICABLE',commencementAge:p.visualStages?.stage3?.retirementStartAge??null,t190AnnuityMonthly:p.visualStages?.stage3?.monthlyT190Pension??null,pensionFundMonthly:p.visualStages?.stage3?.monthlyFundPension??null,totalMonthly:p.visualStages?.stage3?.monthlyTotalIncomeService??null,preservedFamilyValue:p.visualStages?.stage3?.pensionFundPreservedValueOrRights??null}
    }
  });
}

function productBalancesAtDeath(p){
  const balances=Array.isArray(p.balancesByOrigin)?p.balancesByOrigin:[];
  return balances.map(x=>freeze({
    sourceId:x.id??x.sourceId??null,
    wrapper:x.wrapper??null,
    gross:x.gross??x.value??x.balance??null,
    tax:x.tax??x.terminalTax??null,
    net:x.net??x.closingNet??x.valueNet??null,
    basisNominal:x.basisNominal??x.taxBasisNominal??null,
    basisReal:x.basisReal??x.taxBasisReal??null
  }));
}

/**
 * Builds the economic replay DTO expected by U1A from the already-evaluated residual Live projection.
 * The death slider may select the displayed projection upstream, but this adapter cannot alter plan identity.
 */
export function buildScenarioReplayFromLiveResidual(planProjection,liveProjection,{memberDeathAge=null,spouseDeathAge=null,moneyBasis='REAL'}={}){
  const p=assertResidualOnlyLiveProjection(liveProjection);
  if(planProjection?.schemaVersion!=='F8_PLAN_PROJECTION_V2')fail('F8 PlanProjection V2 required');
  const planned=finite(p.displayedScenarioValue,'displayed scenario value');
  const baseline=finite(p.baselineWithoutPlanning.familyValueAtMemberDeath,'baseline scenario value');
  const requestedMemberAge=memberDeathAge??p.scenarioDeathAge??null;
  if(requestedMemberAge!=null&&p.scenarioDeathAge!=null&&Math.abs(Number(requestedMemberAge)-Number(p.scenarioDeathAge))>EPS)
    fail('scenario age must match the already evaluated live projection');
  const requestedSpouseAge=spouseDeathAge??p.spouseDeathAgeScenario??null;
  if(requestedSpouseAge!=null&&p.spouseDeathAgeScenario!=null&&Math.abs(Number(requestedSpouseAge)-Number(p.spouseDeathAgeScenario))>EPS)
    fail('spouse scenario age must match the already evaluated live projection');
  const unavailable=['survivorValue','guaranteeValue','spouseContinuationValue','eventualEstateValue'];
  return freeze({
    schemaVersion:'F8_SCENARIO_REPLAY_V1',planId:planProjection.planId,
    scenarioId:`live-residual:${p.baselineWithoutPlanning?.scenarioDate??p.scenarioDeathAge??'scenario'}`,
    memberDeathAge:requestedMemberAge,spouseDeathAge:requestedSpouseAge,
    valuationDate:p.baselineWithoutPlanning?.scenarioDate??null,moneyBasis,
    familyValueAtMemberDeath:planned,baselineValueAtMemberDeath:baseline,
    immediateCapital:planned,survivorValue:null,guaranteeValue:null,spouseContinuationValue:null,eventualEstateValue:null,
    productBalancesAtDeath:productBalancesAtDeath(p),
    scenarioCashflows:clone(p.survivorFlows??[]),
    yearlyRows:(p.yearlyBalances??[]).map(r=>clone({...r,actionIds:[]})),
    warnings:clone([...(p.explanations??[]),...(p.excludedSources?.length?['EXCLUDED_SOURCES_PRESENT']:[])]),
    unavailableComponents:unavailable,
    provenance:{adapter:'U1B_LIVE_RESIDUAL_SCENARIO_ADAPTER_V1',sourceVersion:p.sourceVersion,reconciliation:clone(p.debug?.reconciliation??null),finalUsePathIds:clone(p.debug?.finalUsePathIds??[])}
  });
}

export function buildScenarioProjectionFromLiveResidual(planProjection,liveProjection,scenario={}){
  return buildF8ScenarioProjection(planProjection,buildScenarioReplayFromLiveResidual(planProjection,liveProjection,scenario));
}

/** Existing M11 committed plans remain the authoritative positive-path source when supplied. */
export function buildPlanProjectionFromIntegratedCommit(args={}){
  if(args?.committedPlan?.status!=='COMMITTED_PLAN_SNAPSHOT')fail('committed integrated plan required');
  return buildF8PlanProjection(args);
}