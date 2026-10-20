import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { rankDrivers, normalizeDraft, type Candidate } from './schemas';
const now=Date.parse('2026-10-19T00:00:00Z');
const candidate=(id:string,lat:number,type='dodavka'):Candidate=>({id,name:id,vehicleType:type,plate:'TEST',capacity:8,lat,lng:16,updatedAt:new Date(now).toISOString(),online:true,busy:false});
describe('Group driver recommendations',()=>{
 test('closest appropriate vehicle first',()=>{const ranked=rankDrivers([candidate('far',49.5),candidate('close',49.01),candidate('car',49,'osobni')],{lat:49,lng:16},'van',now);assert.deepEqual(ranked.map(c=>c.id),['close','far']);assert.ok((ranked[0]?.distance ?? Infinity) < 2);});
 test('busy or offline drivers are unavailable',()=>{assert.deepEqual(rankDrivers([{...candidate('busy',49),busy:true},{...candidate('offline',49),online:false}],null,null,now),[]);});
 test('stale coordinates never provide a distance',()=>{assert.equal(rankDrivers([{...candidate('old',49),updatedAt:'2026-10-18T00:00:00Z'}],{lat:49,lng:16},null,now)[0]?.distance,null);});
 test('larger groups preserve passenger count',()=>{assert.equal(normalizeDraft({pickup:null,destination:null,scheduledTime:null,passengers:12,vehicleType:null,phone:null,notes:null,warnings:[]}).passengers,12);});
});
