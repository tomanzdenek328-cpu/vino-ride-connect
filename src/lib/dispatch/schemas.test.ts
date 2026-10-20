import { describe, test, expect } from 'bun:test';
import { rankDrivers, normalizeDraft, type Candidate } from './schemas';
const now=Date.parse('2026-10-19T00:00:00Z');
const candidate=(id:string,lat:number,type='dodavka'):Candidate=>({id,name:id,vehicleType:type,plate:'TEST',capacity:8,lat,lng:16,updatedAt:new Date(now).toISOString(),online:true,busy:false});
describe('Group driver recommendations',()=>{
 test('closest appropriate vehicle first',()=>{const ranked=rankDrivers([candidate('far',49.5),candidate('close',49.01),candidate('car',49,'osobni')],{lat:49,lng:16},'van',now);expect(ranked.map(c=>c.id)).toEqual(['close','far']);expect(ranked[0]?.distance).toBeLessThan(2);});
 test('busy or offline drivers are unavailable',()=>{expect(rankDrivers([{...candidate('busy',49),busy:true},{...candidate('offline',49),online:false}],null,null,now)).toEqual([]);});
 test('stale coordinates never provide a distance',()=>{expect(rankDrivers([{...candidate('old',49),updatedAt:'2026-10-18T00:00:00Z'}],{lat:49,lng:16},null,now)[0]?.distance).toBeNull();});
 test('larger groups preserve passenger count',()=>{expect(normalizeDraft({pickup:null,destination:null,scheduledTime:null,passengers:12,vehicleType:null,phone:null,notes:null,warnings:[]}).passengers).toBe(12);});
});
