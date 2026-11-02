import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import path from 'node:path';

const dirs=['public','scripts','tests'];let checked=0;
for(const dir of dirs)for(const name of await fs.readdir(dir)){
 if(!/\.(js|mjs)$/.test(name))continue;
 const file=path.join(dir,name),result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr||`Syntax check failed: ${file}`);
 checked++;
 if(dir==='public'){
  const source=await fs.readFile(file,'utf8');
  for(const match of source.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g))await fs.access(path.resolve(dir,match[1]));
 }
}
new vm.Script(await fs.readFile('../backend/Code.gs','utf8'),{filename:'backend/Code.gs'});
JSON.parse(await fs.readFile('public/manifest.webmanifest','utf8'));
console.log(`PASS: syntax of ${checked} JS modules + GAS, local imports and manifest`);
