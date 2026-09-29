import {extractF8LiveContracts} from './f8-live-contracts.js';
import {buildF8Projection} from './f8-projection.js';
import {F8LiveResidualPlanner} from '../F8_CORE/live/residual.js';

const $=id=>document.getElementById(id),money=x=>new Intl.NumberFormat('he-IL',{maximumFractionDigits:0}).format(Math.round(x))+' ₪';
let plannedKey=null,planned=null,timer=null,lastError=null,lastSnapshot=null;
function active(){return window.F8RouteOwnershipV1?.ownsInheritanceResults()===true}
function ensure(){let root=$('inheritanceS15Root');if(!root){window.InheritanceResultsControllerS16A?.renderPoint?.();root=$('inheritanceS15Root')}root?.classList.add('f8-owned');
 if(root&&!$('h12bSpouseDeath')&&window.AppBridgeS54?.inheritanceContext?.()?.spouseExpected===true){const box=$('s16DeathBox');if(box){const el=document.createElement('div');el.id='h12bSpouseDeath';el.className='h12b-spouse-death';el.innerHTML='<div class="h12b-spouse-head"><strong>אם בן/בת הזוג נפטר/ת בגיל <span id="h12bSpouseDeathText">90</span></strong><div class="s15-agebox"><input id="h12bSpouseDeathNumber" type="number" step="1" value="90"></div></div><input id="h12bSpouseDeathSlider" type="range" step="1" value="90"><div class="s15-scale"><span>110</span><span id="h12bSpouseDeathMin">—</span></div>';box.appendChild(el);const slider=$('h12bSpouseDeathSlider'),number=$('h12bSpouseDeathNumber');slider.addEventListener('input',()=>{number.value=slider.value;$('h12bSpouseDeathText').textContent=slider.value});number.addEventListener('change',()=>{slider.value=number.value;$('h12bSpouseDeathText').textContent=number.value});schedule(40)}}
 return root}
function text(id,value){const el=$(id);if(el&&el.textContent!==value)el.textContent=value}
function show(p){const root=ensure();if(!root)return;
 if(window.__F8_U1D_VIEWMODEL_MODE===true)return;
 if(p.status==='WORKING_QA'){
  const member=$('s15DeathSlider'),number=$('s15DeathNumber');if(Number.isFinite(p.scenarioDeathAge)){if(member)member.value=String(p.scenarioDeathAge);if(number&&document.activeElement!==number)number.value=String(p.scenarioDeathAge)}
  const spouse=$('h12bSpouseDeathSlider'),spouseNumber=$('h12bSpouseDeathNumber'),spouseText=$('h12bSpouseDeathText');if(spouse&&spouseNumber){const age=Number(window.AppBridgeS54?.inheritanceContext?.()?.spouseAge),min=Number.isFinite(age)?Math.round(age):18;for(const control of [spouse,spouseNumber]){control.min=String(min);control.max='110'}$('h12bSpouseDeathMin').textContent=String(min);const selected=Number.isFinite(p.spouseDeathAgeScenario)?p.spouseDeathAgeScenario:Number(spouseNumber.value);if(Number.isFinite(selected)){spouse.value=String(selected);if(document.activeElement!==spouseNumber)spouseNumber.value=String(selected);spouseText.textContent=String(Math.round(selected))}}
 }
 const subtitle=root.querySelector('.s15-head .s15-sub');if(subtitle)subtitle.textContent='שינוי גיל הפטירה מעדכן את תרחיש התצוגה. בחירת התוכנית נעשית מראש מתוך הנתונים האישיים.';
 const cards=root.querySelector('.s15-cards');if(cards&&!$('h12bPlannedCard')){const node=document.createElement('div');node.id='h12bPlannedCard';node.className='s15-card';node.innerHTML='<div class="s15-label" id="h12bPlannedLabel"></div><div class="s15-value" id="h12bPlannedValue">—</div><div class="s15-card-sub" id="h12bPlannedSub"></div>';cards.appendChild(node)}
 if(p.status!=='WORKING_QA'){text('s16BaseValue','—');text('h12bPlannedValue','—');text('s16Status',`חסר נתון בסיסי: ${(p.missing??[]).join(', ')}`);$('uxInheritanceVisualJourney')?.setAttribute('hidden','');return}
 const age=Number.isFinite(p.scenarioDeathAge)?` בגיל ${Math.round(p.scenarioDeathAge)}`:'';
 text('s16Status','');text('s16BaseLabel',`ללא תכנון${age}`);text('h12bPlannedLabel',`עם תכנון${age}`);
 text('s16BaseValue',money(p.baselineWithoutPlanning.familyValueAtMemberDeath));text('h12bPlannedValue',money(p.selectedPlan.familyValueAtMemberDeath));
 text('s16BaseSub','ההון נשאר במוצריו. סכום נטו לאחר תשואה, דמי ניהול ומס.');text('h12bPlannedSub','ההון נשאר במסלול ההוני; רכיבים שאין להם נתוני חוזה מספיקים אינם נבחרים.');
 let plan=$('f8ActionPlan');if(!plan){plan=document.createElement('section');plan.id='f8ActionPlan';root.appendChild(plan)}plan.replaceChildren();const h=document.createElement('h3');h.textContent='מה לעשות בתוכנית זו';plan.appendChild(h);const ul=document.createElement('ul');for(const line of p.explanations){const li=document.createElement('li');li.textContent=line;ul.appendChild(li)}plan.appendChild(ul);
}
function compute(){if(!active())return;const bridge=window.F8IntegrationBridgeV1;if(!bridge)return;try{
 const deathNumber=$('s15DeathNumber'),deathSlider=$('s15DeathSlider');if(deathNumber&&deathSlider&&!deathNumber.value)deathNumber.value=deathSlider.value;
 const snapshot=bridge.snapshot(),contracts=extractF8LiveContracts(window,snapshot),key=contracts.status==='READY_WORKING_QA'?JSON.stringify(contracts.data):null;
 if(key!==plannedKey){planned=key?new F8LiveResidualPlanner().plan(contracts.data):null;plannedKey=key}
 const dto=buildF8Projection(contracts,snapshot,planned);lastSnapshot=snapshot;window.F8ProjectionDTO=dto;document.documentElement.dataset.f8LiveStatus=dto.status;show(dto);document.dispatchEvent(new CustomEvent('f8:projection',{detail:dto}));lastError=null;
 }catch(error){lastError=error;const failure=Object.freeze({schemaVersion:'F8_PROJECTION_V1',status:'MISSING_BASIC_INPUT',missing:['שגיאה בחוזה הנתונים; נדרשת בדיקה'],moduleStatus:{rotation:'R_ZERO',qualifying:'Q_ZERO',long:'Q_LONG_ZERO'}});window.F8ProjectionDTO=failure;show(failure);console.error('F8 live projection',error)}}
function schedule(ms=90){clearTimeout(timer);timer=setTimeout(compute,ms)}
document.addEventListener('inheritance:model-committed',()=>schedule(70));
document.addEventListener('input',e=>{if(active())schedule(e.target?.matches?.('#s15DeathSlider,#s15DeathNumber,#h12bSpouseDeathSlider,#h12bSpouseDeathNumber')?65:180)},true);
document.addEventListener('change',()=>schedule(100),true);
document.addEventListener('click',e=>{if(e.target?.closest?.('#goalOptions [data-goal="inheritance"],#inheritanceObjectiveContinueS57,#view-results .back,#view-results [data-back]'))schedule(250)},true);
const view=$('view-results');if(view)new MutationObserver(()=>schedule(40)).observe(view,{attributes:true,attributeFilter:['class']});
window.addEventListener('pageshow',()=>schedule(250));
window.F8LiveBinding=Object.freeze({version:'F8_LIVE_MVP_V1',recompute:compute,lastError:()=>lastError,lastSnapshot:()=>lastSnapshot,planIdentity:()=>planned,contract:{optimizer:'F8_ONLY',projectionSource:'F8_PROJECTION_V1',optionalModulesFailClosed:true}});
schedule(300);