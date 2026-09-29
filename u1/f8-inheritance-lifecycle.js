import {buildInheritanceViewModel} from './f8-binding.js';

const fail=m=>{throw new Error(`U1C_LIFECYCLE: ${m}`)};
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const v of Object.values(x))freeze(v);Object.freeze(x)}return x};

export const INHERITANCE_EVENT_KIND=freeze({
  MATERIAL_ECONOMIC_INPUT:'MATERIAL_ECONOMIC_INPUT',
  SCENARIO_INPUT:'SCENARIO_INPUT',
  DISPLAY_INPUT:'DISPLAY_INPUT',
  UI_ONLY_INPUT:'UI_ONLY_INPUT'
});

function validatePlan(p){
  if(p?.schemaVersion!=='F8_PLAN_PROJECTION_V2')fail('F8PlanProjection V2 required');
  for(const k of ['planId','generation','inputHash','rulesVersion','modelVersion','identityHash'])if(p[k]==null)fail(`plan identity missing ${k}`);
  return p;
}
function validateScenario(plan,s){
  if(s?.schemaVersion!=='F8_SCENARIO_PROJECTION_V2')fail('F8ScenarioProjection V2 required');
  if(!s.scenarioId)fail('scenarioId required');
  if(s.planId!==plan.planId||s.planIdentityHash!==plan.identityHash)fail('scenario does not belong to current plan');
  return s;
}
function validateBundle(bundle,generation){
  const plan=validatePlan(bundle?.planProjection),scenario=validateScenario(plan,bundle?.scenarioProjection);
  if(plan.generation!==generation)fail('material projection generation mismatch');
  return {planProjection:plan,scenarioProjection:scenario};
}

/**
 * U1C owns reconciliation only. Economic computation is injected through projection providers.
 * It never calls an optimizer directly and never derives money fields from UI/DOM values.
 */
export function createInheritanceLifecycleV2({
  initialPlanProjection,
  initialScenarioProjection,
  materialProjectionProvider,
  scenarioProjectionProvider,
  renderer,
  initialDisplayBasis='REAL',
  route='INHERITANCE'
}={}){
  if(route!=='INHERITANCE')fail('inheritance lifecycle is route-scoped');
  let plan=validatePlan(initialPlanProjection);
  let scenario=validateScenario(plan,initialScenarioProjection);
  if(typeof materialProjectionProvider!=='function')fail('materialProjectionProvider required');
  if(typeof scenarioProjectionProvider!=='function')fail('scenarioProjectionProvider required');
  if(!renderer||typeof renderer.commitAtomic!=='function')fail('InheritanceRendererV2 required');

  let generation=plan.generation;
  let displayBasis=initialDisplayBasis;
  let activeRoute=route;
  let requestRevision=0;
  let lastCommittedRevision=0;
  let uiState=freeze({});

  const makeViewModel=()=>buildInheritanceViewModel(plan,scenario,{displayBasis,route:'INHERITANCE',goal:'INHERITANCE'});
  const commit=(revision)=>{
    const vm=makeViewModel();
    if(revision!==requestRevision)return freeze({committed:false,stale:true,reason:'REVISION_STALE'});
    if(activeRoute!=='INHERITANCE')return freeze({committed:false,stale:true,reason:'ROUTE_INACTIVE'});
    if(vm.identity.generation!==generation||vm.identity.planId!==plan.planId||vm.identity.scenarioId!==scenario.scenarioId)
      return freeze({committed:false,stale:true,reason:'IDENTITY_STALE'});
    const result=renderer.commitAtomic(vm,{route:activeRoute,generation,planId:plan.planId,scenarioId:scenario.scenarioId});
    if(result?.committed)lastCommittedRevision=revision;
    return result;
  };

  return freeze({
    schemaVersion:'F8_INHERITANCE_LIFECYCLE_V2',
    snapshot(){return freeze({generation,planProjection:plan,scenarioProjection:scenario,displayBasis,route:activeRoute,uiState,lastCommittedRevision,requestRevision});},
    initialCommit(){requestRevision+=1;return commit(requestRevision);},
    async dispatch(event){
      const kind=event?.kind;
      if(!Object.values(INHERITANCE_EVENT_KIND).includes(kind))fail('unknown event kind');
      const revision=++requestRevision;

      if(kind===INHERITANCE_EVENT_KIND.MATERIAL_ECONOMIC_INPUT){
        const targetGeneration=generation+1;
        const bundle=await materialProjectionProvider({payload:event.payload??{},generation:targetGeneration,previousPlanProjection:plan});
        if(revision!==requestRevision||activeRoute!=='INHERITANCE')return freeze({committed:false,stale:true,reason:'MATERIAL_RESPONSE_STALE'});
        const next=validateBundle(bundle,targetGeneration);
        generation=targetGeneration;plan=next.planProjection;scenario=next.scenarioProjection;
        return commit(revision);
      }

      if(kind===INHERITANCE_EVENT_KIND.SCENARIO_INPUT){
        const planAtRequest=plan;
        const generationAtRequest=generation;
        const nextScenario=await scenarioProjectionProvider({planProjection:planAtRequest,payload:event.payload??{},generation:generationAtRequest});
        if(revision!==requestRevision||generationAtRequest!==generation||planAtRequest.planId!==plan.planId||activeRoute!=='INHERITANCE')
          return freeze({committed:false,stale:true,reason:'SCENARIO_RESPONSE_STALE'});
        scenario=validateScenario(plan,nextScenario);
        return commit(revision);
      }

      if(kind===INHERITANCE_EVENT_KIND.DISPLAY_INPUT){
        displayBasis=event.payload?.displayBasis??displayBasis;
        return commit(revision);
      }

      uiState=freeze({...uiState,...(event.payload??{})});
      if(typeof renderer.applyUiOnly==='function')renderer.applyUiOnly(uiState,{route:activeRoute});
      return freeze({committed:false,stale:false,uiOnly:true});
    },
    setRoute(nextRoute){
      requestRevision+=1;
      activeRoute=nextRoute;
      if(typeof renderer.setRoute==='function')renderer.setRoute(nextRoute);
      return activeRoute;
    }
  });
}