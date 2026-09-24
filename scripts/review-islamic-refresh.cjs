const { chromium } = require('@playwright/test');
const fs = require('fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await page.addInitScript(()=>localStorage.setItem('daybreak.state.v1',JSON.stringify({version:1,onboarded:true,theme:'serene',journal:[],completions:[],alarms:[]})));
 fs.mkdirSync('artifacts/islamic-refresh',{recursive:true});
 for(const [name,url] of [['home','/home'],['numbers','/challenge?id=demo&preview=1&kind=number_order'],['tile-recall','/challenge?id=demo&preview=1&kind=color_focus'],['pattern','/challenge?id=demo&preview=1&kind=sequence'],['fajr','/challenge?id=demo&preview=1&kind=fajr_reminder'],['moon','/themes']]){
  await page.goto('http://127.0.0.1:8082'+url);await page.waitForTimeout(800); await page.screenshot({path:`artifacts/islamic-refresh/${name}.png`});
 }
 await page.goto('http://127.0.0.1:8082/challenges');
 await page.getByRole('button',{name:'Islamic supplication',exact:true}).click();
 await page.getByRole('button',{name:'Dua: Upon waking',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'artifacts/islamic-refresh/dua-picker.png'});
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
