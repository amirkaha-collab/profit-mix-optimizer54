import {stableHash} from '../u1/f8-stable-hash.js';
import {buildPlanProjectionFromLiveResidual,buildScenarioProjectionFromLiveResidual} from '../u1/f8-projection-adapters.js';
import {createInheritanceLifecycleV2,INHERITANCE_EVENT_KIND} from '../u1/f8-inheritance-lifecycle.js';
import {createInheritanceRendererV2} from '../u1/f8-inheritance-renderer-v2.js';

const $=id=>document.getElementById(id);
let lifecycle=null,renderer=null,host=null,currentMaterialKey=null,generation=0,latestProjection=null;
window.__F8_U1D_VIEWMODEL_MODE=true;

function active(){return window.F8RouteOwnershipV1?.ownsInheritanceResults?.()===true}
const DISPLAY_NOTE_DEFAULT='תצוגה בלבד — אינה משנה את התוכנית או את החישוב.';
function syncDisplayCapability(){
  const bar=$('resultDisplayToolbarS54');if(!bar)return;
  const nominal=bar.querySelector('[data-result-display-s54="nominal"]'),real=bar.querySelector('[data-result-display-s54="real_today"]'),note=bar.querySelector('.s54-note');
  const on=active();
  if(nominal){
    if(nominal.dataset.u1dOriginalDisabled==null)nominal.dataset.u1dOriginalDisabled=String(!!nominal.disabled);
    nominal.disabled=on?true:nominal.dataset.u1dOriginalDisabled==='true';
    nominal.setAttribute('aria-disabled',String(nominal.disabled));
    nominal.title=on?'תצוגה נומינלית מאומתת אינה זמינה עדיין במסלול ההורשה החדש.':'';
    if(on){nominal.classList.remove('active');nominal.setAttribute('aria-pressed','false')}
  }
  if(real&&on){real.classList.add('active');real.setAttribute('aria-pressed','true')}
  if(note){
    if(note.dataset.u1dOriginalText==null)note.dataset.u1dOriginalText=note.textContent??DISPLAY_NOTE_DEFAULT;
    note.textContent=on?'כוח הקנייה של היום. תצוגה נומינלית מאומתת עדיין אינה זמינה במסלול ההורשה החדש.':note.dataset.u1dOriginalText;
  }
}
function syncScenarioControls(){
  const spouseSlider=$('h12bSpouseDeathSlider'),spouseNumber=$('h12bSpouseDeathNumber'),spouseMin=$('h12bSpouseDeathMin');
  if(spouseSlider&&spouseNumber){
    const age=Number(window.AppBridgeS54?.inheritanceContext?.()?.spouseAge),min=Number.isFinite(age)?Math.round(age):18;
    for(const control of [spouseSlider,spouseNumber]){control.min=String(min);control.max='110'}
    if(spouseMin)spouseMin.textContent=String(min);
  }
}
function ensureHost(){
  const root=$('inheritanceS15Root');if(!root)return null;
  const cards=root.querySelector('.s15-cards');
  let el=$('uxInheritanceVisualJourney');
  if(!el){el=document.createElement('div');el.id='uxInheritanceVisualJourney';el.setAttribute('dir','rtl');if(cards?.parentNode)cards.after(el);else root.appendChild(el)}
  root.classList.add('u1d-viewmodel-owned');
  return el;
}
function materialKey(p){return stableHash({sourceVersion:p.sourceVersion,currentAge:p.currentAge,expectedFamilyValue:p.expectedFamilyValue,originLots:p.originLots,selectedStrategy:p.selectedPlan?.strategy,moduleStatus:p.moduleStatus,excludedSources:p.excludedSources})}
function identityFor(p,key,nextGeneration){return {generation:nextGeneration,inputHash:key,rulesVersion:'F8_LIVE_RULES_WORKING_QA',modelVersion:'U1D_WORKING_BETA_V1'}}
function buildBundle(p,key,nextGeneration){
  const plan=buildPlanProjectionFromLiveResidual({liveProjection:p,identity:identityFor(p,key,nextGeneration)});
  const scenario=buildScenarioProjectionFromLiveResidual(plan,p,{memberDeathAge:p.scenarioDeathAge??null,spouseDeathAge:p.spouseDeathAgeScenario??null,moneyBasis:'REAL'});
  return {planProjection:plan,scenarioProjection:scenario};
}
function createFor(p){
  host=ensureHost();if(!host)return;
  currentMaterialKey=materialKey(p);generation=1;const bundle=buildBundle(p,currentMaterialKey,generation);
  renderer=createInheritanceRendererV2({root:host});
  lifecycle=createInheritanceLifecycleV2({
    initialPlanProjection:bundle.planProjection,initialScenarioProjection:bundle.scenarioProjection,renderer,
    materialProjectionProvider:async({generation:target})=>buildBundle(latestProjection,materialKey(latestProjection),target),
    scenarioProjectionProvider:async({planProjection})=>buildScenarioProjectionFromLiveResidual(planProjection,latestProjection,{memberDeathAge:latestProjection.scenarioDeathAge??null,spouseDeathAge:latestProjection.spouseDeathAgeScenario??null,moneyBasis:'REAL'})
  });
  lifecycle.initialCommit();
}
async function accept(p){
  if(!active()||p?.schemaVersion!=='F8_PROJECTION_V1'||p.status!=='WORKING_QA')return;
  syncDisplayCapability();
  syncScenarioControls();
  latestProjection=p;const key=materialKey(p);
  try{
    if(!lifecycle){createFor(p);return}
    if(host!==ensureHost()){renderer?.dispose?.();lifecycle=null;renderer=null;createFor(p);return}
    if(key!==currentMaterialKey){currentMaterialKey=key;generation+=1;await lifecycle.dispatch({kind:INHERITANCE_EVENT_KIND.MATERIAL_ECONOMIC_INPUT,payload:{source:'LIVE_RESIDUAL_PROJECTION'}});return}
    await lifecycle.dispatch({kind:INHERITANCE_EVENT_KIND.SCENARIO_INPUT,payload:{memberDeathAge:p.scenarioDeathAge??null,spouseDeathAge:p.spouseDeathAgeScenario??null}});
  }catch(error){console.error('Inheritance result view',error)}
}
function routeSync(){
  syncDisplayCapability();
  syncScenarioControls();
  if(!lifecycle)return;
  lifecycle.setRoute(active()?'INHERITANCE':'OTHER');
}
document.addEventListener('f8:projection',e=>accept(e.detail));
document.addEventListener('click',e=>{const b=e.target?.closest?.('#resultDisplayToolbarS54 [data-result-display-s54="nominal"]');if(active()&&b){e.preventDefault();e.stopImmediatePropagation();syncDisplayCapability()}},true);
document.addEventListener('click',()=>setTimeout(routeSync,0),true);
window.addEventListener('pageshow',()=>{const p=window.F8ProjectionDTO;if(p)accept(p)});
window.F8InheritanceU1D=Object.freeze({version:'U1D_WORKING_BETA_V1',acceptProjection:accept,snapshot:()=>lifecycle?.snapshot?.()??null,renderer:()=>renderer?.snapshot?.()??null,contract:Object.freeze({source:'InheritanceViewModelV2',positiveLiveRQQq:false,singleWriter:true})});
if(window.F8ProjectionDTO)setTimeout(()=>accept(window.F8ProjectionDTO),0);