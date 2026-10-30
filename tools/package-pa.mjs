/** Full hand-off: deployable files, private installer and reproducible source. */
import fs from 'node:fs';
import {cmsSnapshot} from './cms-data.mjs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'avecjo-pa-'));
const output=path.join(root,'releases',`avecjo-full-pa-${new Date().toISOString().slice(0,10)}.zip`);
const ignored=new Set(['.git','.firebase','node_modules','dist','releases','.cms-backups','avecjo-data','.DS_Store']);
try{
 fs.cpSync(path.join(root,'dist'),path.join(temp,'public_html'),{recursive:true});
 // The PA test site calls its own PHP API. Production Firebase config stays untouched.
 fs.writeFileSync(path.join(temp,'public_html/runtime-config.json'),JSON.stringify({apiBaseUrl:'/backend/api/index.php',contactEnabled:false},null,2)+'\n');
 fs.cpSync(path.join(root,'server'),path.join(temp,'private-setup'),{recursive:true});
 fs.writeFileSync(path.join(temp,'private-setup/seed.json'),JSON.stringify(cmsSnapshot(root)));
 fs.copyFileSync(path.join(root,'docs/PA-HANDOFF.md'),path.join(temp,'README-PA.md'));
 fs.cpSync(root,path.join(temp,'source'),{recursive:true,filter(source){
   const relative=path.relative(root,source);if(!relative)return true;
   return !relative.split(path.sep).some(part=>ignored.has(part)||part.startsWith('.env')||part==='avecjo-config.php'||/^firebase-debug.*\.log$/.test(part)||part.endsWith('.local.json'));
 }});
 fs.writeFileSync(path.join(temp,'SOURCE-REVISION.txt'),execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()+'\n');
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.rmSync(output,{force:true});
 execFileSync('python3',['-c','import zipfile,pathlib,sys\nr=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED) as z:\n for p in sorted(r.rglob("*")):\n  if p.is_file():z.write(p,p.relative_to(r))',temp,output]);
 console.log(output);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
