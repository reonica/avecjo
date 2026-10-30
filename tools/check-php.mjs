import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'server/api.php'),'utf8');
const functions=source.slice(0,source.indexOf('$configFile =')).replace("require_once __DIR__ . '/store.php';",'');
let run,php;
if(process.env.PHP_WASM_ROOT){const base=process.env.PHP_WASM_ROOT;const {PHP}=await import(pathToFileURL(path.join(base,'@php-wasm/universal/index.js')));const {loadNodeRuntime}=await import(pathToFileURL(path.join(base,'@php-wasm/node/index.js')));php=new PHP(await loadNodeRuntime('8.3',{emscriptenOptions:{processId:process.pid}}));run=async code=>{const r=await php.run({code});if(r.errors)throw new Error(r.errors);return r.text;};}
else{const version=spawnSync('php',['--version'],{encoding:'utf8'});if(version.status!==0){console.error('Install PHP 8.1+ or set PHP_WASM_ROOT to temporary @php-wasm packages.');process.exit(1);}run=async code=>{const r=spawnSync('php',['-r',code.replace(/^<\?php/, '')],{encoding:'utf8'});if(r.status!==0||r.stderr)throw new Error(r.stderr);return r.stdout;};}
const valid={slug:'hanoi-native-test',title:'Un titre',seoTitle:'Un titre SEO',description:'Description',image:'assets/images/photo.jpg',imageAlt:'Hanoi',category:'circuits-vietnam',tags:['Hanoi'],html:'<h2>Bonjour</h2><p>Un voyage ensemble.</p>'};
const literal=data=>`json_decode(base64_decode('${Buffer.from(JSON.stringify(data)).toString('base64')}'),true)`;
const tests=[
 ['admin has full access',`requirePermission(['role'=>'admin','permissions'=>[]],'users.manage');echo 'OK';`,'OK'],
 ['mod edits content',`requirePermission(['role'=>'mod','permissions'=>['content.write']],'content.write');echo 'OK';`,'OK'],
 ['mod cannot read leads',`requirePermission(['role'=>'mod','permissions'=>['content.write']],'leads.read');echo 'BAD';`,'error'],
 ['mod cannot manage users',`requirePermission(['role'=>'mod','permissions'=>['content.write','users.write']],'users.manage');echo 'BAD';`,'error'],
 ['mod cannot approve by default',`requirePermission(['role'=>'mod','permissions'=>['content.write']],'content.approve');echo 'BAD';`,'error'],
 ['explicit mod permission works',`requirePermission(['role'=>'mod','permissions'=>['leads.read']],'leads.read');echo 'OK';`,'OK'],
 ['permissions reject privilege escalation',`permissions(['users.manage']);echo 'BAD';`,'error'],
 ['valid article passes',`validateDocument('posts',${literal(valid)});echo 'OK';`,'OK'],
 ['backend route cannot be overwritten',`validateDocument('posts',${literal({...valid,slug:'backend'})});echo 'BAD';`,'error'],
 ['image traversal rejected',`validateDocument('posts',${literal({...valid,image:'assets/images/../private.jpg'})});echo 'BAD';`,'error'],
 ['HTML script rejected',`validateDocument('posts',${literal({...valid,html:'<script>alert(1)</script>'})});echo 'BAD';`,'error'],
 ['HTML event handler rejected',`validateDocument('posts',${literal({...valid,html:'<img src="x" onerror="alert(1)">'})});echo 'BAD';`,'error'],
 ['encoded JavaScript rejected',`validateDocument('posts',${literal({...valid,html:'<a href="java&#x73;cript:alert(1)">x</a>'})});echo 'BAD';`,'error'],
 ['oversized tags rejected',`validateDocument('posts',${literal({...valid,tags:['x'.repeat(201)]})});echo 'BAD';`,'error'],
 ['unknown document kind rejected',`validateDocument('admins',${literal(valid)});echo 'BAD';`,'error'],
 ['passwords hash and verify',`$hash=password_hash('temporary-test-password',PASSWORD_DEFAULT);echo password_verify('temporary-test-password',$hash)&&!password_verify('wrong-password',$hash)&&$hash!=='temporary-test-password'?'OK':'BAD';`,'OK']
];
let passed=0;
try{for(const [name,body,expected] of tests){const text=await run(functions+body);if(expected==='error'){assert.ok(JSON.parse(text).error,name);assert.ok(!text.includes('BAD'),name);}else assert.equal(text,expected,name);passed++;console.log('PASS',name);}console.log(`${passed}/${tests.length} PHP security checks passed.`);}
finally{php?.exit();}
