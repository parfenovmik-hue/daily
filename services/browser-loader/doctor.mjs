import {chromium} from 'playwright';
import {settings,launchOptions} from './config.mjs';
const config=settings();
const browser=await chromium.launch(launchOptions(config));
try{
 const page=await browser.newPage();await page.setContent('<main><h1>Linux browser smoke</h1></main>');
 if(await page.locator('h1').textContent()!=='Linux browser smoke')throw Error('Browser DOM check failed');
 console.log(JSON.stringify({ok:true,platform:process.platform,arch:process.arch,node:process.version,browser:browser.version(),channel:config.channel,sandboxRequested:true,uid:process.getuid?.(),headless:config.headless}));
}finally{await browser.close();}
