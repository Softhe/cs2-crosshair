import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertLegacy } from '../src/converter';
import { decode, encode } from '../src/codec';
import { defaults } from '../src/model';
// @ts-expect-error Pinned upstream codec used to create independent legacy fixtures.
import { encodeLegacy } from '../src/vendor/sicc/settings/sharecode.js';
// @ts-expect-error Pinned upstream legacy defaults.
import { GAME_DEFAULTS_2000908 } from '../src/vendor/sicc/settings/cfg.js';

const old='cl_crosshairstyle 4; cl_crosshairsize 2; cl_crosshairthickness 0.5; cl_crosshairgap -2; cl_crosshair_drawoutline 0';
test('old config converts to a current share code and preserves unrelated settings',()=>{
  const result=convertLegacy(old,1080,1440,{...defaults,cl_sniper_auto_rezoom:0});
  assert.equal(result.settings.cl_crosshairstyle,4);
  assert.equal(result.settings.cl_crosshair_screen_height,1440);
  assert.equal(result.settings.cl_sniper_auto_rezoom,0);
  assert.equal(decode(encode(result.settings)).settings.cl_crosshair_length,result.settings.cl_crosshair_length);
  assert.ok(result.warnings.some(w=>w.includes('not native-validated')));
  assert.equal((result.report.provenance as {nativeValidated:boolean}).nativeValidated,false);
});
test('version-one codes use the same converter through the normal import path',()=>{
  const code=encodeLegacy({...GAME_DEFAULTS_2000908,style:4,size:2,thickness:.5,gap:-2});
  assert.deepEqual(decode(code).settings,convertLegacy(code).settings);
});
test('conversion blocks default legacy reticles, damaged codes, and current codes',()=>{
  for(const text of ['cl_crosshairstyle 0; cl_crosshairsize 2','cl_crosshairstyle 1; cl_crosshairsize 2','CSGO-aaaaa-aaaaa-aaaaa-aaaaa-aaaaa',encode(defaults),'quit']) assert.throws(()=>convertLegacy(text));
  for(const height of [0,239,Infinity,1080.5,65536]) assert.throws(()=>convertLegacy(old,height));
});
test('old dynamic families explicitly become static cross and report the loss',()=>{
  for(const style of [2,3,5]){
    const result=convertLegacy(old.replace('cl_crosshairstyle 4',`cl_crosshairstyle ${style}`));
    assert.equal(result.settings.cl_crosshairstyle,4);
    assert.ok(result.warnings.length>0);
  }
});
test('outline-only, overlapping arms and zero-size dots still produce valid new codes',()=>{
  for(const extra of ['cl_crosshairsize 0; cl_crosshairdot 1','cl_crosshairgap -10','cl_crosshairsize 0; cl_crosshair_drawoutline 1; cl_crosshair_outlinethickness 2']){
    const result=convertLegacy(old+'; '+extra);
    assert.doesNotThrow(()=>decode(encode(result.settings)));
  }
});
