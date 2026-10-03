import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encode,decode,importCommands} from '../src/codec';
import {defaults,styles,styleFields,validateSettings,commands,cfg,safeAlias,autoexec} from '../src/model';
import {validateLibrary} from '../src/storage';
import {simulatedSpread} from '../src/preview-motion';

test('synthetic dynamic spread respects the configured range above 25 pixels',()=>{
  for(const style of [0,1,7]){
    assert.equal(simulatedSpread(style,255,1),255);
    assert.equal(simulatedSpread(style,64,1),64);
    assert.equal(simulatedSpread(style,0,1),0);
    assert.equal(simulatedSpread(style,128,.5),64);
  }
  assert.equal(simulatedSpread(4,255,1),0);
});

const original='CSxkMfFVRUG6fRehdb2CvLNuajHopsuAQ5O38aVLPTTPHj';
const probe='CSxMSnbcU6TWxCqXiHQJnOiZUdmH7fYtzVys2xfV3kqTBa';
test('matches the exact code exported by installed CS2 1.41.8.8',()=>{
  const {settings:s}=decode(original);
  assert.equal(s.cl_crosshairstyle,4);assert.equal(s.cl_crosshaircolor_g,200);assert.equal(s.cl_crosshairoutline_a,180);
  assert.equal(s.cl_crosshair_dynamic_splitdist,8);assert.equal(s.cl_crosshair_dynamic_splitalpha_innermod,1);
  assert.equal(s.cl_crosshair_dynamic_splitalpha_outermod,.5);assert.equal(s.cl_crosshair_dynamic_maxdist_splitratio,.3);
  assert.equal(s.cl_ironsight_usecrosshaircolor,1);assert.equal(s.cl_ironsight_dot_scale,1);assert.equal(encode(s),original);
});
test('matches the independently exported scope probe',()=>{
  const s=decode(probe).settings;assert.equal(s.cl_crosshairstyle,2);assert.equal(s.cl_ironsight_dot_scale,.45);assert.equal(encode(s),probe);
});
test('matches a website-generated code accepted and re-exported unchanged by CS2',()=>{
  const code='CSsNwa7oeYoRNiRWDNFuWkKojpTuqO7f4KyCsaUxonMtqD';
  const s=decode(code).settings;
  assert.equal(s.cl_crosshairstyle,9);assert.equal(s.cl_crosshair_dynamic_splitalpha_innermod,.67);
  assert.equal(s.cl_crosshair_dynamic_splitalpha_outermod,.43);assert.equal(s.cl_crosshair_dynamic_maxdist_splitratio,.58);
  assert.equal(s.cl_ironsight_dot_scale,1.37);assert.equal(s.cl_ironsight_usecrosshaircolor,0);
  assert.equal(s.cl_crosshairoutline_r,130);assert.equal(s.cl_crosshairoutline_g,27);assert.equal(encode(s),code);
});
test('round trips all ten styles, colors, outline modes, boundaries and packed fields',()=>{
  for(const [style] of styles)for(const outline of [0,1,2]){
    const s={...defaults,cl_crosshairstyle:style,cl_crosshair_drawoutline:outline,cl_crosshair_thickness:32,
      cl_crosshair_gap:style===2?-10:128,cl_crosshair_length:255,cl_crosshaircolor_a:17,
      cl_crosshairoutline_r:73,cl_crosshairoutline_g:234,cl_crosshairoutline_b:9,cl_crosshairoutline_a:112,
      cl_crosshair_dynamic_splitdist:127,cl_crosshair_dynamic_splitalpha_innermod:.67,
      cl_crosshair_dynamic_splitalpha_outermod:.43,cl_crosshair_dynamic_maxdist_splitratio:.58,
      cl_ironsight_dot_scale:1.37,cl_ironsight_usecrosshaircolor:1,cl_crosshairdot:1,cl_crosshair_t:1};
    assert.deepEqual(decode(encode(s)).settings,s);
  }
});
test('rejects corruption, wrong alphabets, match codes, oversized values and future layouts',()=>{
  assert.throws(()=>decode(original.slice(0,-1)+'A'));
  assert.throws(()=>decode(original.replace('x','0')));
  assert.throws(()=>decode('CSGO-GADqf-jjyJ8-cSP2r-smZRo-TO2xK'));
  assert.throws(()=>validateSettings({...defaults,cl_crosshair_thickness:Infinity}));
  assert.throws(()=>validateSettings({...defaults,cl_crosshair_drawoutline:3}));
  assert.throws(()=>validateSettings({quit:1}));
});
test('config importer round trips all settings and ignores unrelated commands',()=>{
  const s={...defaults,cl_crosshair_gap:-4,cl_crosshairstyle:2,cl_ironsight_dot_scale:.51,cl_grenadecrosshairdelay_smoke:.35,cl_grenadecrosshair_smoke:0};
  assert.deepEqual(importCommands(cfg(s)+'\nquit; bind x quit; fps_max 0'),s);
  assert.equal(importCommands('cl_crosshair_recoil "false"').cl_crosshair_recoil,0);
  assert.throws(()=>importCommands('alias stolen "quit"; quit'));
  assert.throws(()=>importCommands('cl_crosshair_length "999"'));
  assert.ok(!commands(defaults).includes('cl_crosshairsize'));
});
test('alias and file names cannot inject commands or traverse directories',()=>{
  for(const name of ['../bad','bad;quit','bad"quit','quit','exec','cl_test','bad space','1bad'])assert.throws(()=>safeAlias(name));
  assert.equal(autoexec(defaults,'team_green'),'alias team_green "exec crosshair_team_green.cfg"');
  assert.equal(safeAlias(''), '');
});
test('menu visibility follows the game style contract',()=>{
  const keys=(style:number)=>styleFields({...defaults,cl_crosshairstyle:style}).map(f=>f.key);
  assert.ok(!keys(6).includes('cl_crosshairdot'));assert.ok(!keys(3).includes('cl_crosshair_length'));
  assert.ok(keys(2).includes('cl_crosshair_dynamic_splitalpha_innermod'));
  assert.ok(!keys(4).includes('cl_crosshair_dynamic_spread_limit'));
  assert.ok(keys(9).includes('cl_crosshair_dynamic_maxdist_splitratio'));
});
test('library validates hostile and malformed backups without executing content',()=>{
  assert.throws(()=>validateLibrary({entries:[]}));assert.throws(()=>validateLibrary([{name:'Bad',favorite:true,settings:{quit:1}}]));
  const safe=validateLibrary([{name:'<script>quit</script>',favorite:true,alias:'team_green',settings:defaults}]);
  assert.equal(safe[0].name,'<script>quit</script>');assert.deepEqual(safe[0].settings,defaults);
});

test('classic dynamic negative gaps preserve the game-accepted fixture and UI bounds',()=>{
  const fixture='CStze9KaaSzUFEQnoTiEBNk57fajhPpmz3oPNOEMPVMCAA';
  const settings=decode(fixture).settings;
  assert.equal(settings.cl_crosshairstyle,2);
  assert.equal(settings.cl_crosshair_gap,-4);
  assert.equal(encode(settings),fixture);
  for(const [style] of styles){
    const gap=styleFields({...defaults,cl_crosshairstyle:style}).find(field=>field.key==='cl_crosshair_gap');
    if(gap)assert.equal(gap.min,-10);
  }
  assert.throws(()=>validateSettings({...settings,cl_crosshair_gap:-11}));
});
