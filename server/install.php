<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/store.php';
$configFile=$argv[1]??dirname(__DIR__).'/avecjo-config.php';
if(!is_file($configFile)){fwrite(STDERR,"Missing private config file.\n");exit(1);}
$config=require $configFile;
if(strlen($config['appKey']??'')<32){fwrite(STDERR,"Generate appKey before installing.\n");exit(1);}
function prompt(string $label,bool $secret=false): string {
    fwrite(STDOUT,$label);if($secret)system('stty -echo');
    try{$value=trim(fgets(STDIN)?:'');}finally{if($secret){system('stty echo');fwrite(STDOUT,"\n");}}
    return $value;
}
try {
    $publicRoot=$argv[2]??dirname(realpath($configFile)).'/public_html';
    if(!is_dir($publicRoot))throw new RuntimeException('Pass the existing public document root as the second argument.');
    $configReal=realpath($configFile);$publicReal=realpath($publicRoot);
    if($configReal===$publicReal||str_starts_with($configReal,$publicReal.DIRECTORY_SEPARATOR))throw new RuntimeException('Configuration must be outside the public root.');
    $store=new FlatFileStore($config['cmsDataDir']??dirname(realpath($configFile)).'/avecjo-data',$publicRoot,true);
    if(!$store->read(static fn(array $state)=>count($state['users']))){
        $username=strtolower(prompt('Admin ID (3–39 letters/numbers/_/-): '));$email=strtolower(prompt('Admin email/Gmail: '));$name=prompt('Display name: ');$password=prompt('Password (12+ characters): ',true);$confirmation=prompt('Repeat password: ',true);
        if(!preg_match('/^[a-z0-9][a-z0-9_-]{2,38}$/D',$username)||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)<12||$password!==$confirmation||$name==='')throw new RuntimeException('Invalid admin details.');
        $hash=password_hash($password,PASSWORD_DEFAULT);unset($password,$confirmation);
        $store->update(static function(array &$state)use($username,$email,$name,$hash){
            if($state['users'])throw new RuntimeException('An admin was created concurrently.');
            $state['users'][1]=['id'=>1,'username'=>$username,'email'=>$email,'display_name'=>substr($name,0,120),'password_hash'=>$hash,'role'=>'admin','permissions'=>[],'enabled'=>true,'is_primary'=>true,'created_at'=>gmdate('c')];
        });echo "Primary admin created in private file storage.\n";
    }
    if(is_file(__DIR__.'/seed.json')){
        $snapshot=json_decode(file_get_contents(__DIR__.'/seed.json'),true,512,JSON_THROW_ON_ERROR);
        $store->update(static function(array &$state)use($snapshot){
            foreach($snapshot['documents'] as $item){$key=$item['kind'].'/'.$item['id'];if(isset($state['documents'][$key]))continue;$state['documents'][$key]=['kind'=>$item['kind'],'id'=>$item['id'],'data'=>$item['data'],'approved_data'=>$item['data'],'state'=>'approved','revision'=>1,'deleted'=>false,'updated_at'=>gmdate('c'),'updated_by'=>1];}
            foreach($snapshot['media'] as $item)if(!isset($state['media'][$item['id']]))$state['media'][$item['id']]=$item+['created_at'=>gmdate('c')];
        });echo "Initial content imported; existing files preserved.\n";
    }
    echo "CMS is ready without MySQL. Sign in using ID or email and CMS password.\n";
    if(!empty($config['dsn'])){
        $db=new PDO($config['dsn'],$config['username'],$config['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$db->exec(file_get_contents(__DIR__.'/schema.sql'));echo "Contact database schema ready.\n";
    }else echo "Contact database is not configured; content, images and accounts remain available.\n";
}catch(Throwable $e){fwrite(STDERR,"Setup failed. Check private configuration, directory permissions and input.\n");exit(1);}
