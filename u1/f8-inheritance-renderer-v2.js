import {statusCopy,actionDisplayAmount} from './f8-u1d-presentation.js';

const fail=m=>{throw new Error(`U1C_RENDERER: ${m}`)};
const owners=new WeakMap();
let ownerSeq=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('he-IL',{maximumFractionDigits:0}).format(Math.round(Number(n)))+' ₪';
const num=n=>new Intl.NumberFormat('he-IL',{maximumFractionDigits:2}).format(Number(n));

function assertViewModel(vm,expected){
  if(vm?.schemaVersion!=='F8_INHERITANCE_VIEW_MODEL_V2')fail('InheritanceViewModel V2 required');
  const id=vm.identity??{};
  for(const k of ['schemaVersion','planId','scenarioId','generation','inputHash','rulesVersion','modelVersion','identityHash'])if(id[k]==null)fail(`ViewModel identity missing ${k}`);
  if(expected.route!=='INHERITANCE'||vm.route!=='INHERITANCE')fail('route mismatch');
  for(const k of ['generation','planId','scenarioId'])if(id[k]!==expected[k])fail(`${k} mismatch`);
  if(vm.reconciliation?.status!=='PASS')fail('U1D reconciliation must pass before render');
}
function cellText(cell,{suffix='',kind='money'}={}){
  if(!cell||!['AVAILABLE_POSITIVE','AVAILABLE_ZERO'].includes(cell.status))return statusCopy(cell?.status)||'לא ניתן לחשב ללא מידע נוסף';
  if(kind==='pct')return `${num(Number(cell.amount)*100)}%${suffix}`;
  if(kind==='number')return `${num(cell.amount)}${suffix}`;
  return `${money(cell.amount)}${suffix}`;
}
function rawMoney(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?money(Number(v)):'לא ניתן לחשב ללא מידע נוסף'}
function actionById(vm,id){return vm.actionPlan.actions.find(a=>a.actionId===id)??null}
function displayEntity(v){const t=String(v??'').toUpperCase();if(/SAVINGS_POLICY|POLICY/.test(t))return 'פוליסת חיסכון';if(/T190.*QUALIFY|QUALIFY/.test(t))return 'הרובד המזכה';if(/T190|RECOGNIZED/.test(t))return 'תיקון 190 — הון מוכר';if(/PENSION/.test(t))return 'קרן הפנסיה';if(/ANNUITY/.test(t))return 'מסלול הקצבה';return 'המקור/היעד המתוכנן'}
function actionLabel(a){
  if(!a)return 'פעולה שאינה זמינה';
  const type=String(a.actionType??'').toUpperCase();
  const amount=actionDisplayAmount(a),amt=amount==null?'':` — ${money(amount)}`;
  const src=displayEntity(a.sourceType??a.sourceId),dst=displayEntity(a.destinationType??a.destinationId);
  if(/ANNUIT/.test(type))return `המרה לקצבה מ־${src}${amt}`;
  if(/ROTATION/.test(type))return `ביצוע רוטציה מהמקור המתוכנן${amt}`;
  if(/QUALIFY|TRANSFER|CONTRIBUTE/.test(type))return `העברה מ־${src} אל ${dst}${amt}`;
  if(/WITHDRAW|REALIZE/.test(type))return `משיכה / מימוש מ־${src}${amt}`;
  if(/REINVEST/.test(type))return `השקעה מחדש אל ${dst}${amt}`;
  if(/RESIDUAL/.test(type))return `השארת היתרה במסלול הקיים${amt}`;
  return `פעולה מתוכננת${amt}`;
}
function bucketName(id){return ({SAVINGS_POLICY:'פוליסת חיסכון',T190_RECOGNIZED:'תיקון 190 — הון מוכר',T190_QUALIFYING:'רובד מזכה'})[id]??id}
function productName(p){
  const t=String(p?.productType??p?.wrapper??'').toUpperCase();
  if(t.includes('SAVINGS_POLICY'))return 'פוליסת חיסכון';
  if(t.includes('T190'))return 'תיקון 190';
  if(t.includes('PENSION'))return 'קרן פנסיה';
  return p?.displayName??p?.name??'מוצר קיים';
}
function renderHeadline(vm){
  const h=vm.headline;
  return `<section class="u1d-headline" aria-label="השוואת תוצאה"><div class="u1d-compare"><div><span>ללא תכנון</span><strong>${esc(cellText(h.baseline.total))}</strong></div><div><span>עם התכנון</span><strong>${esc(cellText(h.planned.total))}</strong></div></div><div class="u1d-expected"><b>למה זו התוכנית שנבחרה?</b> ${esc(h.expectedPlanExplanation)}<br><span>הערך המשפחתי הצפוי: עם התכנון ${esc(cellText(h.expectedPlanned))}; ללא תכנון ${esc(cellText(h.expectedBaseline))}.</span></div></section>`;
}
function renderStage1(stage){
  const products=(stage.products??[]).map(p=>`<div class="u1d-product"><b>${esc(productName(p))}</b><span>${esc(rawMoney(p.balance??p.amount??p.openingBalance))}</span></div>`).join('');
  return `<section class="uxv-stage s1"><div class="uxv-stagehead"><span class="uxv-n">1</span><div><div class="uxv-title">נקודת הפתיחה</div><div class="uxv-kicker">${stage.age==null?'הנתונים הקיימים בתוכנית':`גיל ${esc(stage.age)}`}</div></div></div><div class="u1d-product"><b>הון שמיועד לתכנון ההורשה</b><span>${esc(cellText(stage.capitalForPlanning))}</span></div>${products||'<div class="u1d-status">לא ניתן להציג פירוט מוצרים ללא מידע נוסף.</div>'}</section>`;
}
function renderStage2(vm,stage){
  const actions=stage.actionRefs.map(id=>actionById(vm,id)).filter(Boolean);
  const actionHtml=actions.length?`<div class="u1d-arrows">${actions.map(a=>`<div class="u1d-action">${esc(actionLabel(a))}</div>`).join('')}</div>`:'<div class="u1d-status">לא נדרשת פעולה במסלול זה</div>';
  const cols=stage.buckets.map(b=>{const cost=[];if(['AVAILABLE_POSITIVE','AVAILABLE_ZERO'].includes(b.taxPaid?.status))cost.push(`מס: ${cellText(b.taxPaid)}`);if(['AVAILABLE_POSITIVE','AVAILABLE_ZERO'].includes(b.feesPaid?.status))cost.push(`עלויות: ${cellText(b.feesPaid)}`);return `<div class="u1d-bucket"><b>${esc(bucketName(b.bucketId))}</b><span>${esc(cellText(b.closingBalance))}</span>${b.actionRefs?.length?`<small>${b.actionRefs.length} פעולות מתוכננות</small>`:'<small>לא נדרשת פעולה</small>'}${cost.length?`<small>${esc(cost.join(' · '))}</small>`:''}</div>`}).join('');
  return `<section class="uxv-stage s2"><div class="uxv-stagehead"><span class="uxv-n">2</span><div><div class="uxv-title">העברות לאורך השנים</div><div class="uxv-kicker">הפעולות המתוכננות והיעדים שלהן</div></div></div>${actionHtml}<div class="u1d-three-buckets">${cols}</div></section>`;
}
function renderStage3(stage){
  if(stage.status==='NOT_APPLICABLE')return `<section class="uxv-stage s3"><div class="uxv-stagehead"><span class="uxv-n">3</span><div><div class="uxv-title">תחילת הקצבה / רוטציה</div></div></div><div class="u1d-status">לא רלוונטי לתוכנית זו</div></section>`;
  const age=stage.commencementAge==null?'מועד התחלה אינו זמין':`מגיל ${stage.commencementAge}`;
  return `<section class="uxv-stage s3"><div class="uxv-stagehead"><span class="uxv-n">3</span><div><div class="uxv-title">תחילת הקצבה / רוטציה</div><div class="uxv-kicker">${esc(age)}</div></div></div><div class="uxv-pension-list"><div class="uxv-pension-row t190"><span>קצבה מתיקון 190</span><span class="amt">${esc(cellText(stage.t190AnnuityMonthly,{suffix:' לחודש'}))}</span></div><div class="uxv-pension-row fund"><span>קצבה מקרן הפנסיה</span><span class="amt">${esc(cellText(stage.pensionFundMonthly,{suffix:' לחודש'}))}</span></div><div class="uxv-pension-row total"><span>סה״כ קצבה</span><span class="amt">${esc(cellText(stage.totalMonthly,{suffix:' לחודש'}))}</span></div><div class="uxv-pension-row"><span>צורך חודשי</span><span class="amt">${esc(cellText(stage.requiredService,{suffix:' לחודש'}))}</span></div><div class="uxv-pension-row"><span>שאירים לבן/בת זוג</span><span class="amt">${esc(cellText(stage.survivorPct,{kind:'pct'}))}</span></div><div class="uxv-pension-row"><span>תשלומים מובטחים</span><span class="amt">${esc(cellText(stage.guaranteeMonths,{kind:'number',suffix:' חודשים'}))}</span></div><div class="uxv-pension-row family"><span>ערך שנשמר בקרן הפנסיה לטובת המשפחה</span><span class="amt">${esc(cellText(stage.preservedFamilyValue))}</span></div></div></section>`;
}
function renderStage4(stage){
  const rows=[['הון שמתקבל מיד',stage.immediateCapital],['ערך זכויות שאירים',stage.survivorValue],['ערך תשלומים מובטחים',stage.guaranteeValue],['ערך שממשיך דרך בן/בת הזוג',stage.spouseContinuationValue],['הון עתידי בעיזבון',stage.eventualEstateValue]].filter(([,v])=>v?.status!=='NOT_APPLICABLE');
  return `<section class="uxv-stage s4"><div class="uxv-stagehead"><span class="uxv-n">4</span><div><div class="uxv-title">מה המשפחה מקבלת</div><div class="uxv-kicker">${stage.memberDeathAge==null?'בתרחיש המוצג':`בתרחיש פטירה בגיל ${esc(stage.memberDeathAge)}`}</div></div></div><div class="uxv-death-total"><strong>${esc(cellText(stage.totalFamilyValue))}</strong><span>סה״כ ערך למשפחה בתרחיש המוצג</span></div>${rows.map(([k,v])=>`<div class="uxv-deathrow"><span>${esc(k)}</span><span class="amt">${esc(cellText(v))}</span></div>`).join('')}</section>`;
}
function renderJourney(vm){
  const stages=vm.journey.stages;
  return `<section class="u1d-journey"><div class="uxv-head"><h3>מה קורה לכסף לאורך החיים?</h3><div class="uxv-sub">מה היה בתחילת הדרך, מה עושים לאורך השנים, מה קורה בקצבה ומה המשפחה מקבלת בתרחיש שנבחר.</div></div><div class="uxv-timeline">${renderStage1(stages.find(s=>s.type==='OPENING_STATE'))}${renderStage2(vm,stages.find(s=>s.type==='TRANSFER_JOURNEY'))}${renderStage3(stages.find(s=>s.type==='ANNUITY_ROTATION'))}${renderStage4(stages.find(s=>s.type==='FAMILY_OUTCOME'))}</div></section>`;
}
function rowActionObjects(vm,row){return (row.actionIds??[]).map(id=>actionById(vm,id)).filter(Boolean)}
function rowActions(vm,row,kind='ALL'){const arr=rowActionObjects(vm,row).filter(a=>{const t=String(a.actionType??'').toUpperCase();if(kind==='IN')return /TRANSFER|CONTRIBUTE|QUALIFY|REINVEST/.test(t);if(kind==='OUT')return /WITHDRAW|ANNUIT|ROTATION|REALIZE/.test(t);return true});return arr.map(actionLabel).join(' · ')||'—'}
function rowProductEntries(vm,row,matcher){
  const opening=vm.journey.stages.find(s=>s.type==='OPENING_STATE');const meta=new Map((opening?.products??[]).map(p=>[p.productId??p.id,p]));
  const raw=Array.isArray(row.productBalances)?row.productBalances:Object.entries(row.byProduct??{}).map(([productId,x])=>({productId,...x}));
  return raw.filter(x=>matcher(String(x.productType??x.wrapper??meta.get(x.productId)?.productType??meta.get(x.productId)?.wrapper??''))).map(x=>({name:productName({...meta.get(x.productId),...x}),value:x.closingBalance??x.closingNet??x.closing??x.net??x.balance??null}));
}
function productCell(vm,row,matcher){const xs=rowProductEntries(vm,row,matcher);if(!xs.length)return 'לא ניתן לחשב ללא מידע נוסף';return xs.map(x=>`${x.name}: ${rawMoney(x.value)}`).join(' · ')}
function renderYearly(vm){
  const rows=vm.yearlyTable.rows;
  return `<details class="u1d-section"><summary>פירוט שנתי — תנועות הכסף</summary><div class="uxv-tablewrap"><table><thead><tr><th>שנה / גיל</th><th>פוליסת חיסכון</th><th>תיקון 190 — הון מוכר</th><th>תיקון 190 — קצבתי</th><th>רובד מזכה</th><th>קרן פנסיה</th><th>הפקדה / העברה</th><th>משיכה / קצבה</th><th>מס</th><th>דמי ניהול / עלויות</th><th>הערה</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.calendarYear)}${r.memberAge!=null?` / ${esc(Number(r.memberAge).toFixed(1))}`:''}</td><td>${esc(productCell(vm,r,t=>/SAVINGS_POLICY|POLICY/.test(t)))}</td><td>${esc(productCell(vm,r,t=>/T190|RECOGNIZED/.test(t)&&!/QUALIFY|ANNUIT/.test(t)))}</td><td>${esc(productCell(vm,r,t=>/T190.*ANNUIT|ANNUIT.*T190/.test(t)))}</td><td>${esc(productCell(vm,r,t=>/QUALIFY/.test(t)))}</td><td>${esc(productCell(vm,r,t=>/PENSION/.test(t)))}</td><td>${esc(rowActions(vm,r,'IN'))}</td><td>${esc(rowActions(vm,r,'OUT'))}</td><td>${esc(rawMoney(r.taxTotal??r.tax))}</td><td>${esc(rawMoney(r.feesTotal??r.fees))}</td><td>${r.projectionStatus==='ACTION_ONLY'?'פעולה מתוכננת; נתוני מאזן שנתי אינם זמינים.':'לפי ההקרנה השנתית הזמינה'}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function actionWhen(a){if(a.memberAge!=null)return `בגיל ${num(a.memberAge)}`;if(a.taxYear!=null)return `בשנת ${a.taxYear}`;if(a.date)return `במועד ${a.date}`;return 'המועד דורש מידע נוסף'}
function actionWhy(a){return a.reasonText??(a.explanationKey?'הסבר הפעולה זמין בפירוט המקצועי.':'הסיבה המפורטת לפעולה אינה זמינה ללא מידע נוסף.')}
function renderActionGroup(title,actions){if(!actions?.length)return '';return `<div class="u1d-plan-group"><h4>${esc(title)}</h4><ol>${actions.map(a=>`<li><b>${esc(actionWhen(a))}:</b> ${esc(actionLabel(a))}<small>למה: ${esc(actionWhy(a))}</small>${a.executionApplicability?.kind==='CONTINGENT_SCENARIOS'?'<small>הפעולה מותנית בהתקיימות התנאים שנקבעו לתרחיש הביצוע.</small>':''}${a.stopCondition?`<small>תנאי עצירה/בדיקה מחדש: ${esc(a.stopCondition)}</small>`:''}${a.legalStatus==='UNVERIFIED'||a.executionStatus==='UNVERIFIED'?'<small>דורש אימות לפני ביצוע</small>':''}</li>`).join('')}</ol></div>`}
function renderActionPlan(vm){const g=vm.actionPlan.groups,stops=[...new Set(vm.actionPlan.actions.map(a=>a.stopCondition).filter(Boolean))];return `<section class="u1d-action-plan"><h3>מה עושים בפועל</h3>${renderActionGroup('עכשיו',g.NOW)}${renderActionGroup('פעולות עתידיות לפי גיל / שנה',g.FUTURE)}${renderActionGroup('בתחילת הקצבה',g.COMMENCEMENT)}${renderActionGroup('לאחר תחילת הקצבה',g.POST_COMMENCEMENT)}${vm.actionPlan.actions.length?'':'<div class="u1d-status">לא נדרשת פעולה בתוכנית זו.</div>'}${stops.length?`<div class="u1d-verify"><b>מתי לעצור ולבדוק מחדש</b><ul>${stops.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}<div class="u1d-verify"><b>לפני ביצוע</b><ul>${vm.actionPlan.verification.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></section>`}
function renderProfessional(vm){return `<details class="uxv-professional"><summary>פירוט מקצועי</summary><div class="uxv-profgrid"><div class="uxv-profcard"><b>מצב אימות</b><br>${vm.professionalDetails.blockedReasons?.length?'קיימים רכיבים שדורשים אימות לפני שימוש מעשי.':'לא סומנו חסמי אימות נוספים.'}</div><div class="uxv-profcard"><b>עקביות</b><br>ההשוואה, מסלול הכסף, הטבלה ותוכנית הפעולה משתמשים באותה תוכנית ובאותן פעולות.</div></div></details>`}

function stageDom(root,vm){
  const doc=root?.ownerDocument;
  if(!doc?.createDocumentFragment||!doc?.createElement)return {kind:'MODEL_ONLY',viewModel:vm};
  const fragment=doc.createDocumentFragment();
  const shell=doc.createElement('section');
  shell.setAttribute('data-f8-owner','InheritanceRendererV2');
  shell.setAttribute('data-schema-version',vm.schemaVersion);
  shell.setAttribute('data-plan-id',vm.identity.planId);
  shell.setAttribute('data-scenario-id',vm.identity.scenarioId);
  shell.setAttribute('data-generation',String(vm.identity.generation));
  shell.setAttribute('dir','rtl');
  shell.className='u1d-results';
  shell.innerHTML=`${renderHeadline(vm)}${renderJourney(vm)}${renderYearly(vm)}${renderActionPlan(vm)}${renderProfessional(vm)}`;
  fragment.appendChild(shell);
  return fragment;
}

export function createInheritanceRendererV2({root}={}){
  if(!root||typeof root!=='object')fail('inheritance root required');
  if(owners.has(root))fail('inheritance root already has an active DOM writer');
  const ownerId=`inheritance-renderer-v2:${++ownerSeq}`;
  owners.set(root,ownerId);
  let activeRoute='INHERITANCE';
  let lastIdentity=null;
  let lastViewModel=null;
  let disposed=false;
  const assertOwner=()=>{if(disposed||owners.get(root)!==ownerId)fail('renderer is not active DOM owner')};
  return Object.freeze({
    schemaVersion:'F8_INHERITANCE_RENDERER_V2',ownerId,
    commitAtomic(vm,expected){
      assertOwner();assertViewModel(vm,expected);
      if(activeRoute!=='INHERITANCE')return Object.freeze({committed:false,stale:true,reason:'ROUTE_INACTIVE'});
      const staged=stageDom(root,vm);
      if(typeof root.replaceChildren==='function')root.replaceChildren(staged);else root.__f8AtomicTree=staged;
      lastIdentity=Object.freeze({...vm.identity});lastViewModel=vm;
      return Object.freeze({committed:true,ownerId,identity:lastIdentity});
    },
    applyUiOnly(uiState,{route}={}){assertOwner();if(route!==activeRoute)return;root.__f8UiOnlyState=uiState;},
    setRoute(route){assertOwner();activeRoute=route;},
    snapshot(){return Object.freeze({ownerId,activeRoute,lastIdentity,lastViewModel,disposed});},
    dispose(){assertOwner();owners.delete(root);disposed=true;}
  });
}
export function hasActiveInheritanceDomWriter(root){return owners.has(root)};