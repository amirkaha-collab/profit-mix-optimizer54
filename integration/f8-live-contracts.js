import {normalizeResidualInput} from '../F8_CORE/live/residual.js';
const ok=x=>typeof x==='number'&&Number.isFinite(x);
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const v of Object.values(x))freeze(v);Object.freeze(x)}return x};
const ageToDate=(start,currentAge,age)=>{const days=Math.round((age-currentAge)*365.2425),d=new Date(`${start}T00:00:00.000Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
/** Only this boundary touches host primitives. The optimizer receives copied, frozen data. */
export function extractF8LiveContracts(host,snapshot,{date=new Date().toISOString().slice(0,10)}={}){
 if(snapshot?.schemaVersion!=='F8_CANONICAL_SCENARIO_V1'||!Object.isFrozen(snapshot))throw new Error('canonical snapshot required');
 const age=snapshot.person.currentAge,capital=snapshot.capital.lumpSum,returnRate=snapshot.economics.nominalReturn,fee=snapshot.economics.fees.savingsPolicy,inflation=snapshot.economics.inflation;
 const missing=[];for(const [key,value] of Object.entries({currentAge:age,capital,nominalReturn:returnRate,savingsPolicyFee:fee,inflation}))if(!ok(value))missing.push(key);
 if(missing.length)return freeze({status:'MISSING_BASIC_INPUT',missing,moduleStatus:{rotation:'R_ZERO',qualifying:'Q_ZERO',long:'Q_LONG_ZERO'}});
 const rules=host?.RULES?.rules??{},policyTax=rules.savingsPolicyCapitalTax?.rate;
 if(!ok(policyTax))return freeze({status:'MISSING_BASIC_INPUT',missing:['policy capital-gain tax primitive'],moduleStatus:{rotation:'R_ZERO',qualifying:'Q_ZERO',long:'Q_LONG_ZERO'}});
 const c=host?.AppBridgeS54?.inheritanceContext?.()??{},inputs=c.lastInput??{};
 const annualDistribution=host?.InheritanceMortalityS59?.distribution?.({sex:snapshot.person.sex,currentAge:age});
 if(annualDistribution?.status!=='ok'||!Array.isArray(annualDistribution.rows))return freeze({status:'MISSING_BASIC_INPUT',missing:['ex-ante mortality distribution'],moduleStatus:{rotation:'R_ZERO',qualifying:'Q_ZERO',long:'Q_LONG_ZERO'}});
 const scenarios=annualDistribution.rows.filter(r=>r.deathProbability>0&&r.evaluationAge>=age).map((r,i)=>({id:`mortality_age_${r.age}_${i}`,weight:r.deathProbability,memberDeathDate:ageToDate(date,age,r.evaluationAge),discountRate:0}));
 const sum=scenarios.reduce((n,s)=>n+s.weight,0);if(!(sum>0))throw new Error('mortality probabilities absent');for(const s of scenarios)s.weight/=sum;
 const provenance={source:'LEGACY_COMPATIBILITY',productionVerified:false,useScope:'WORKING_QA',primitives:['CanonicalScenarioSnapshot','RULES.rules.savingsPolicyCapitalTax','InheritanceMortalityS59.distribution']};
 const basis=Number(inputs.policyTaxBasis??inputs.taxBasisNominal);const nominalBasis=Number.isFinite(basis)&&basis>=0?basis:capital;
 const originLots=[{id:'fresh_policy_capital',economicPathId:'origin:fresh_policy_capital',sourceEventId:'initial_decision_capital',availabilityDate:date,amount:capital,taxBasisNominal:nominalBasis,taxBasisReal:nominalBasis,wrapper:'savings_policy',owner:'member',annualFee:fee,taxTreatment:{basis:'indexed',rate:policyTax}}];
 const excludedSources=[];
 // Existing assets are separate origins only when an actual positive balance and basis are exposed.
 for(const [id,balanceKey,basisKey,wrapper,annualFee,basisType,rate] of [
  ['existing_policy','existingPolicyBalance','existingPolicyTaxBasis','savings_policy',fee,'indexed',policyTax],
  ['existing_t190','existingRecognizedT190Balance','existingRecognizedT190Basis','t190',snapshot.economics.fees.t190,'nominal',rules.t190CapitalTax?.rate]
 ]){const amount=Number(inputs[balanceKey]),rawBasis=inputs[basisKey],b=Number(rawBasis);if(amount>0){if(rawBasis==null||rawBasis===''||!Number.isFinite(b)||b<0||!ok(annualFee)||!ok(rate)){excludedSources.push({id,amount,reason:'MISSING_BASIS_FEE_OR_TAX'});continue}originLots.push({id,economicPathId:`origin:${id}`,sourceEventId:`existing:${id}`,availabilityDate:date,amount,taxBasisNominal:b,taxBasisReal:b,wrapper,owner:'member',annualFee,taxTreatment:{basis:basisType,rate}})}}
 const data=normalizeResidualInput({schemaVersion:'F8_LIVE_RESIDUAL_V1',mode:'WORKING_QA',valuationStartDate:date,annualNominalReturn:returnRate,annualInflation:inflation,originLots,scenarios,provenance});
 const verified=inputs.verifiedQualifyingCapacityByYear??c.decision?.verifiedQualifyingCapacityByYear??null;
 const capacity=verified&&typeof verified==='object'?Object.entries(verified).filter(([y,a])=>/^\d{4}$/.test(y)&&Number.isFinite(Number(a))&&Number(a)>0).map(([year,amount])=>({year:Number(year),amount:Number(amount)})):[];
 return freeze({status:'READY_WORKING_QA',data,capacity,excludedSources,moduleStatus:{rotation:'MISSING_DATED_SURVIVOR_CONTRACT',qualifying:capacity.length?'CANDIDATE_REQUIRES_ECONOMIC_CERTIFICATE':'MISSING_INDIVIDUAL_VERIFIED_CAPACITY',long:'MISSING_DATED_LONG_CONTRACT'},sensitivityOnly:snapshot.sensitivityOnly,sourceVersion:'F8_LIVE_NORMALIZED_V1'});
}
export function memberDeathDateForDisplay(data,currentAge,scenarioAge){if(!ok(scenarioAge)||scenarioAge<currentAge)return null;return ageToDate(data.valuationStartDate,currentAge,scenarioAge)}