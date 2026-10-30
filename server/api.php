<?php
declare(strict_types=1);
/** PHP 8.1+, Fileinfo. PDO MySQL is optional and used only by contact data. Configuration lives OUTSIDE the public document root. */
require_once __DIR__ . '/store.php';
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
function respond(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(int $status, string $message): never { respond($status, ['error' => $message]); }
function input(): array {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 600000) fail(413, 'Dữ liệu quá lớn.');
    if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) fail(415, 'Yêu cầu application/json.');
    $raw = file_get_contents('php://input', false, null, 0, 600001);
    if ($raw === false || strlen($raw) > 600000) fail(413, 'Dữ liệu quá lớn.');
    try { $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException $e) { fail(400, 'JSON không hợp lệ.'); }
    if (!is_array($data) || array_is_list($data)) fail(400, 'Dữ liệu không hợp lệ.');
    return $data;
}
function field(array $data, string $key, int $max, bool $required = true): string {
    if (!is_string($data[$key] ?? null) && array_key_exists($key, $data)) fail(422, "Trường $key phải là văn bản.");
    $value = trim($data[$key] ?? '');
    if (($required && $value === '') || strlen($value) > $max) fail(422, "Trường $key không hợp lệ.");
    return $value;
}
function only(array $data, array $fields): void {
    if (array_diff(array_keys($data), $fields)) fail(422, 'Có trường dữ liệu không được hỗ trợ.');
}
function sql(PDO $db, string $query, array $args = []): PDOStatement {
    $stmt = $db->prepare($query); $stmt->execute($args); return $stmt;
}
function permissions(mixed $value): array {
    $allowed=['content.write','content.approve','seo.write','media.write','leads.read','leads.write','leads.delete'];
    if(!is_array($value)||!array_is_list($value)||count($value)>count($allowed))fail(422,'Quyền không hợp lệ.');
    foreach($value as $permission)if(!is_string($permission)||!in_array($permission,$allowed,true))fail(422,'Quyền không hợp lệ.');
    return array_values(array_unique($value));
}
function requirePermission(array $user,string $permission): void {
    if($user['role']!=='admin'&&!in_array($permission,$user['permissions']??[],true))fail(403,'Bạn chưa được admin cấp quyền thực hiện thao tác này.');
}
function validateDocument(string $kind,array $data): void {
    $kinds=['posts','pages','landing-pages','categories','tags','faqs','seo','guides','settings'];
    if(!in_array($kind,$kinds,true)||strlen(json_encode($data))>500000)fail(422,'Loại nội dung hoặc dung lượng không hợp lệ.');
    if(in_array($kind,['posts','pages','landing-pages','categories','guides'],true)){
        $slug=field($data,'slug',120);
        if(!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D',$slug)||in_array($slug,['backend','admin','assets','api','content','data','tools','web','server','cms','dist','index','blog','contact','photo','recherche','merci','sitemap','gfv','circuits','services'],true))fail(422,'Đường dẫn bị trùng với trang hệ thống.');
        field($data,'title',500);field($data,'description',3000,false);
    }
    if($kind==='guides'){
        foreach(['label','seoTitle','lead','area','coverPost'] as $f)field($data,$f,10000);
        if(!is_array($data['sections']??null)||!array_is_list($data['sections'])||count($data['sections'])<1||count($data['sections'])>40)fail(422,'Cần từ 1 đến 40 mục nội dung.');
        foreach($data['sections'] as $section){if(!is_array($section))fail(422,'Mục nội dung không hợp lệ.');field($section,'heading',500);field($section,'text',20000);if(isset($section['items'])){if(!is_array($section['items'])||count($section['items'])>100)fail(422,'Danh sách ý quá dài.');foreach($section['items'] as $item)if(!is_string($item)||strlen($item)>3000)fail(422,'Ý nội dung không hợp lệ.');}}
        if(!is_array($data['faq']??null)||count($data['faq'])>40)fail(422,'FAQ không hợp lệ.');foreach($data['faq'] as $faq){if(!is_array($faq))fail(422,'FAQ không hợp lệ.');field($faq,'question',1000);field($faq,'answer',10000);}
    }
    if(in_array($kind,['seo','faqs'],true)){$page=field($data,'page',200,false);if($page!==''&&!preg_match('~^[a-z0-9-]+(?:/[a-z0-9-]+)*$~D',$page))fail(422,'Nhập đường dẫn không có dấu / ở đầu hoặc cuối.');}
    if(isset($data['canonical'])&&$data['canonical']!==''&&(!filter_var($data['canonical'],FILTER_VALIDATE_URL)||!str_starts_with($data['canonical'],'https://')))fail(422,'Canonical cần là URL HTTPS.');
    foreach(['noindex','published'] as $f)if(isset($data[$f])&&!is_bool($data[$f]))fail(422,'Trường hiển thị phải là boolean.');
    if($kind==='posts'){foreach(['seoTitle','image','imageAlt','category'] as $f)field($data,$f,1000);if(!is_array($data['tags']??null)||count($data['tags'])>50)fail(422,'Tags không hợp lệ.');foreach($data['tags'] as $tag)if(!is_string($tag)||strlen($tag)>200)fail(422,'Tags không hợp lệ.');}
    if($kind==='faqs'){field($data,'question',1000);field($data,'answer',10000);field($data,'page',200,false);}
    if($kind==='tags')field($data,'title',200);
    foreach(['html','descriptionHtml'] as $key)if(isset($data[$key])){
        $html=field($data,$key,400000,false);
        $html=preg_replace('~<iframe src="https://www\.youtube\.com/embed/[A-Za-z0-9_-]*" title="[^"<>]*" allowfullscreen loading="lazy"></iframe>~','',$html);
        if(preg_match('~<\s*(script|style|object|embed|iframe|svg|math|base|link|meta|form|input|button|textarea|template|noscript)\b|\bon[a-z]+\s*=~i',$html))fail(422,'Nội dung chứa HTML chủ động không được phép.');
        preg_match_all('~\b(?:href|src|poster|style)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))~i',$html,$matches,PREG_SET_ORDER);
        foreach($matches as $m){$url=preg_replace('/[\x00-\x20\x7f]/','',html_entity_decode($m[1]?:($m[2]??'')?:($m[3]??''),ENT_QUOTES|ENT_HTML5,'UTF-8'));if(preg_match('~^(javascript|vbscript|data):|expression\(|url\(["\']?(javascript|vbscript|data):~i',$url))fail(422,'Liên kết HTML không an toàn.');}
    }
    if(isset($data['image'])&&$data['image']!==''&&!preg_match('~^/?assets/images/[a-zA-Z0-9_./-]+\.(jpe?g|png|webp|gif|avif)$~i',$data['image']))fail(422,'Ảnh phải nằm trong assets/images.');
    if(isset($data['image'])&&str_contains($data['image'],'..'))fail(422,'Đường dẫn ảnh không hợp lệ.');
}
function auditState(array &$state, array $user, string $action, string $target): void {
    $state['audit'][]=['user_id'=>$user['id'],'action'=>$action,'target'=>$target,'at'=>gmdate('c')];
    $state['audit']=array_slice($state['audit'],-2000);
}
function publicUser(array $user): array {
    return array_intersect_key($user,array_flip(['id','username','email','display_name','role','permissions','enabled','is_primary','created_at']));
}
function rateLimit(FlatFileStore $store, array $config, string $scope, int $maximum): void {
    $key=hash_hmac('sha256',$scope.'|'.($_SERVER['REMOTE_ADDR']??'unknown'),$config['appKey']);$bucket=intdiv(time(),900);
    $hits=$store->update(static function(array &$state)use($key,$bucket):int{
        foreach($state['rates'] as $id=>$value)if($value['bucket']<$bucket-1)unset($state['rates'][$id]);
        $entry=$state['rates'][$key]??['bucket'=>$bucket,'hits'=>0];if($entry['bucket']!==$bucket)$entry=['bucket'=>$bucket,'hits'=>0];
        $entry['hits']++;$state['rates'][$key]=$entry;return $entry['hits'];
    });
    if($hits>$maximum){header('Retry-After: '.(900-time()%900));fail(429,'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.');}
}
function bearerHash(): string {
    $header=$_SERVER['HTTP_AUTHORIZATION']??$_SERVER['REDIRECT_HTTP_AUTHORIZATION']??'';
    if(!preg_match('/^Bearer ([A-Za-z0-9_-]{43})$/D',$header,$m))fail(401,'Vui lòng đăng nhập.');
    return hash('sha256',$m[1]);
}
function currentUser(FlatFileStore $store): array {
    $hash=bearerHash();
    $user=$store->read(static function(array $state)use($hash):?array{
        $session=$state['sessions'][$hash]??null;
        if(!$session||$session['expires_at']<=time())return null;
        $user=$state['users'][$session['user_id']]??null;
        return $user&&$user['enabled']?publicUser($user):null;
    });
    if(!$user)fail(401,'Phiên đăng nhập đã hết hạn hoặc đã bị thu hồi.');return $user;
}
function contactsDatabase(array $config): PDO {
    if(empty($config['dsn']))fail(503,'Chưa kết nối MySQL cho dữ liệu liên hệ. Các module nội dung vẫn hoạt động bình thường.');
    $db=new PDO($config['dsn'],$config['username']??'',$config['password']??'',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
    sql($db,"SET time_zone = '+00:00'");return $db;
}
function handleContacts(FlatFileStore $store,array $config,?array $user,string $route,string $method): void {
    if($route==='leads'&&$method==='POST'){
        rateLimit($store,$config,'lead',5);$data=input();only($data,['name','email','phone','message','source','consent','website','requestId']);
        if(field($data,'website',200,false)!=='')fail(422,'Yêu cầu không hợp lệ.');
        $name=field($data,'name',120);$email=field($data,'email',200);$phone=field($data,'phone',60,false);$message=field($data,'message',10000);$source=field($data,'source',500);$requestId=field($data,'requestId',36);
        if(!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($message)<10||!str_starts_with($source,'/')||str_starts_with($source,'//')||!preg_match('/^[a-f0-9-]{36}$/D',$requestId))fail(422,'Thông tin liên hệ không hợp lệ.');
        if(($data['consent']??false)!==true)fail(422,'Cần đồng ý để chúng tôi phản hồi yêu cầu.');
        $db=contactsDatabase($config);
        try{sql($db,"INSERT INTO leads (request_id,name,email,phone,message,source,notes,consent_at) VALUES (?,?,?,?,?,?,'',UTC_TIMESTAMP())",[$requestId,$name,$email,$phone,$message,$source]);}
        catch(PDOException $e){if(($e->errorInfo[1]??0)!==1062)throw $e;}
        respond(201,['ok'=>true]);
    }
    if($user===null)fail(401,'Vui lòng đăng nhập.');
    requirePermission($user,'leads.read');
    if($route==='stats'&&$method==='GET'){
        if(empty($config['dsn']))respond(200,['contactsConfigured'=>false,'stats'=>null]);
        $db=contactsDatabase($config);$stats=sql($db,"SELECT COUNT(*) total,COALESCE(SUM(status='new'),0) fresh,COALESCE(SUM(created_at>=UTC_DATE()),0) today FROM leads")->fetch();respond(200,['contactsConfigured'=>true,'stats'=>$stats]);
    }
    if($route==='leads'&&$method==='GET'){
        $db=contactsDatabase($config);$cursor=max(0,(int)($_GET['cursor']??0));$limit=min(100,max(1,(int)($_GET['limit']??50)));$q=substr(trim($_GET['q']??''),0,120);$status=$_GET['status']??'';$where=['id>?'];$args=[$cursor];
        if($q!==''){$where[]='(name LIKE ? OR email LIKE ?)';$args[]='%'.$q.'%';$args[]='%'.$q.'%';}
        if($status!==''){if(!in_array($status,['new','contacted','qualified','closed','spam'],true))fail(422,'Trạng thái không hợp lệ.');$where[]='status=?';$args[]=$status;}
        $rows=sql($db,'SELECT id,name,email,phone,message,source,status,notes,created_at,updated_at,consent_at FROM leads WHERE '.implode(' AND ',$where).' ORDER BY id ASC LIMIT '.($limit+1),$args)->fetchAll();$more=count($rows)>$limit;if($more)array_pop($rows);
        respond(200,['items'=>$rows,'nextCursor'=>$more?(int)end($rows)['id']:null]);
    }
    if(preg_match('~^leads/([1-9][0-9]*)$~D',$route,$m)){
        $id=$m[1];
        if($method==='PATCH'){
            requirePermission($user,'leads.write');$data=input();only($data,['status','notes']);$status=field($data,'status',20);$notes=field($data,'notes',4000,false);
            if(!in_array($status,['new','contacted','qualified','closed','spam'],true))fail(422,'Trạng thái không hợp lệ.');
            $db=contactsDatabase($config);if(!sql($db,'SELECT id FROM leads WHERE id=?',[$id])->fetch())fail(404,'Không tìm thấy liên hệ.');sql($db,'UPDATE leads SET status=?,notes=? WHERE id=?',[$status,$notes,$id]);
            $store->update(static function(array &$state)use($user,$id){auditState($state,$user,'lead.update',$id);});respond(200,['ok'=>true]);
        }
        if($method==='DELETE'){
            requirePermission($user,'leads.delete');$db=contactsDatabase($config);sql($db,'DELETE FROM leads WHERE id=?',[$id]);$store->update(static function(array &$state)use($user,$id){auditState($state,$user,'lead.delete',$id);});respond(200,['ok'=>true]);
        }
    }
    fail(404,'Không tìm thấy chức năng.');
}
function validateSettings(string $id,array $data): void {
    if(!in_array($id,['site','home','aio','business'],true))fail(422,'Cấu hình không được hỗ trợ.');
    if($id==='site'){
        foreach(['name','domain','email','phone','address','description','logo','hero'] as $f)field($data,$f,3000);
        if(!filter_var($data['email'],FILTER_VALIDATE_EMAIL)||!preg_match('~^https://[A-Za-z0-9.-]+$~D',$data['domain']))fail(422,'Email hoặc domain canonical không hợp lệ.');
    }
    if($id==='aio')field($data,'intro',20000);
    if($id==='home'){field($data,'title',500);field($data,'description',3000);}
    if($id==='business'){
        field($data,'businessDescription',10000);if(!is_array($data['areas']??null)||count($data['areas'])>100)fail(422,'Danh sách khu vực không hợp lệ.');
        foreach($data['areas'] as $area)if(!is_string($area)||strlen($area)>300)fail(422,'Khu vực không hợp lệ.');
    }
}
function handleContent(FlatFileStore $store,array $user,string $route,string $method,array $config): void {
    if($route==='overview'&&$method==='GET'){
        if($user['role']!=='admin'&&!in_array('content.write',$user['permissions'],true))respond(200,['posts'=>[],'pages'=>0,'landingPages'=>0,'categories'=>0,'tags'=>0,'faqs'=>0,'contactsConfigured'=>!empty($config['dsn'])]);
        $result=$store->read(static function(array $state):array{
            $docs=array_filter($state['documents'],static fn($d)=>!$d['deleted']);$count=static fn($kind)=>count(array_filter($docs,static fn($d)=>$d['kind']===$kind));
            $posts=[];foreach($docs as $doc)if($doc['kind']==='posts')$posts[]=array_intersect_key($doc['data'],array_flip(['slug','title','date','category']));
            usort($posts,static fn($a,$b)=>strcmp($b['date']??'',$a['date']??''));
            return ['posts'=>$posts,'pages'=>$count('pages')+$count('guides'),'landingPages'=>$count('landing-pages'),'categories'=>$count('categories'),'tags'=>$count('tags'),'faqs'=>$count('faqs')];
        });$result['contactsConfigured']=!empty($config['dsn']);respond(200,$result);
    }
    if($route==='content'&&$method==='GET'){
        $kind=field($_GET,'kind',30);requirePermission($user,in_array($kind,['seo','settings'],true)?'seo.write':'content.write');
        $items=$store->read(static function(array $state)use($kind):array{
            $items=[];foreach($state['documents'] as $doc)if($doc['kind']===$kind&&!$doc['deleted'])$items[]=['id'=>$doc['id'],'kind'=>$kind,'slug'=>$doc['data']['slug']??'','title'=>$doc['data']['title']??$doc['data']['question']??$doc['id'],'state'=>$doc['state'],'revision'=>$doc['revision'],'updated_at'=>$doc['updated_at']];
            usort($items,static fn($a,$b)=>strcmp($b['updated_at'],$a['updated_at']));return $items;
        });respond(200,['items'=>$items]);
    }
    if(preg_match('~^content/([a-z-]+)/([a-z0-9-]{1,120})$~D',$route,$m)){
        $kind=$m[1];$id=$m[2];$key=$kind.'/'.$id;requirePermission($user,in_array($kind,['seo','settings'],true)?'seo.write':'content.write');
        if($method==='GET'){
            $doc=$store->read(static fn(array $state)=>$state['documents'][$key]??null);if(!$doc||$doc['deleted'])fail(404,'Không tìm thấy nội dung.');unset($doc['approved_data']);respond(200,['item'=>$doc]);
        }
        if($method==='DELETE'){
            requirePermission($user,'content.approve');$store->update(static function(array &$state)use($key,$kind,$user):void{
                $doc=$state['documents'][$key]??null;if(!$doc)fail(404,'Không tìm thấy nội dung.');
                if(in_array($kind,['guides','settings'],true)||!empty($doc['data']['sourceUrl']))fail(409,'Trang lịch sử cần giữ URL; hãy chỉnh sửa hoặc thiết lập redirect trước khi xóa.');
                foreach($state['documents'] as $other){if($other['deleted'])continue;foreach([$other['data'],$other['approved_data']] as $data){if(!$data)continue;if(($kind==='categories'&&($data['category']??null)===($doc['data']['slug']??''))||($kind==='posts'&&($data['coverPost']??null)===($doc['data']['slug']??'')))fail(409,'Nội dung vẫn đang được mục khác sử dụng.');}}
                $state['documents'][$key]['deleted']=true;$state['documents'][$key]['approved_data']=null;$state['documents'][$key]['revision']++;auditState($state,$user,'content.delete',$key);
            });respond(200,['ok'=>true]);
        }
        if($method==='POST'||$method==='PATCH'){
            $body=input();only($body,['data','state','revision']);$data=$body['data']??null;$newState=$body['state']??'draft';if(!is_array($data)||!in_array($newState,['draft','review','approved'],true))fail(422,'Nội dung không hợp lệ.');
            if($newState==='approved')requirePermission($user,'content.approve');validateDocument($kind,$data);if($kind==='settings')validateSettings($id,$data);
            $revision=$store->update(static function(array &$state)use($kind,$id,$key,$data,$body,$newState,$user):int{
                $record=$state['documents'][$key]??null;if($record&&(int)($body['revision']??0)!==$record['revision'])fail(409,'Nội dung đã được người khác cập nhật. Hãy mở lại trước khi lưu.');
                $slug=$data['slug']??'';$routeKinds=['posts','pages','landing-pages','guides','categories'];
                if($record&&($record['data']['slug']??'')!==$slug&&in_array($kind,$routeKinds,true))fail(422,'Không đổi URL nội dung đã tạo.');
                if(in_array($kind,$routeKinds,true))foreach($state['documents'] as $otherKey=>$other)if($otherKey!==$key&&in_array($other['kind'],$routeKinds,true)&&($other['data']['slug']??null)===$slug)fail(409,'Đường dẫn đã được sử dụng.');
                if(in_array($kind,['posts','guides'],true)){
                    $referenceKind=$kind==='posts'?'categories':'posts';$referenceSlug=$data[$kind==='posts'?'category':'coverPost'];$valid=false;
                    foreach($state['documents'] as $other)if($other['kind']===$referenceKind&&!$other['deleted']&&($other['data']['slug']??null)===$referenceSlug&&($newState!=='approved'||$other['approved_data']!==null)){$valid=true;break;}
                    if(!$valid)fail(422,'Chuyên mục hoặc bài lấy ảnh bìa chưa tồn tại/chưa được duyệt.');
                }
                $revision=($record['revision']??0)+1;$approved=$newState==='approved'?$data:(!empty($record['deleted'])?null:($record['approved_data']??null));
                $state['documents'][$key]=['kind'=>$kind,'id'=>$id,'data'=>$data,'approved_data'=>$approved,'state'=>$newState,'revision'=>$revision,'deleted'=>false,'updated_at'=>gmdate('c'),'updated_by'=>$user['id']];auditState($state,$user,'content.'.$newState,$key);return $revision;
            });respond(200,['ok'=>true,'revision'=>$revision]);
        }
    }
    if($route==='media'&&$method==='GET'){requirePermission($user,'media.write');respond(200,['items'=>$store->read(static fn(array $state)=>array_values($state['media']))]);}
    if($route==='media'&&$method==='POST'){
        requirePermission($user,'media.write');rateLimit($store,$config,'upload',30);$file=$_FILES['file']??null;
        if(!$file||$file['error']!==UPLOAD_ERR_OK||$file['size']>5242880)fail(422,'Ảnh không hợp lệ hoặc vượt 5 MB.');
        $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);$types=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','image/gif'=>'gif','image/avif'=>'avif'];
        if(!isset($types[$mime])||!getimagesize($file['tmp_name']))fail(422,'Chỉ nhận ảnh JPEG, PNG, WebP, GIF hoặc AVIF.');
        $id=bin2hex(random_bytes(16));$path='assets/images/cms-'.$id.'.'.$types[$mime];$target=dirname(__DIR__,2).'/'.$path;
        if(!is_dir(dirname($target)))mkdir(dirname($target),0755,true);$hash=hash_file('sha256',$file['tmp_name']);$alt=field($_POST,'alt',1000,false);
        if(!move_uploaded_file($file['tmp_name'],$target))fail(503,'Không ghi được ảnh lên hosting.');
        $item=['id'=>$id,'path'=>$path,'alt_text'=>$alt,'bytes'=>$file['size'],'sha256'=>$hash,'created_at'=>gmdate('c')];
        try{$store->update(static function(array &$state)use($item,$user){$state['media'][$item['id']]=$item;auditState($state,$user,'media.upload',$item['path']);});}catch(Throwable $e){unlink($target);throw $e;}respond(201,['item'=>$item]);
    }
    if(preg_match('~^media/([a-z0-9-]+)$~D',$route,$m)&&$method==='PATCH'){
        requirePermission($user,'media.write');$data=input();only($data,['alt_text']);$alt=field($data,'alt_text',1000,false);$id=$m[1];
        $store->update(static function(array &$state)use($id,$alt){if(!isset($state['media'][$id]))fail(404,'Không tìm thấy ảnh.');$state['media'][$id]['alt_text']=$alt;});respond(200,['ok'=>true]);
    }
    if($route==='export'&&$method==='GET'){
        requirePermission($user,'content.approve');$snapshot=$store->read(static function(array $state):array{
            $documents=[];foreach($state['documents'] as $doc)if(!$doc['deleted']&&$doc['approved_data']!==null)$documents[]=['kind'=>$doc['kind'],'id'=>$doc['id'],'data'=>$doc['approved_data']];
            return ['version'=>1,'documents'=>$documents,'media'=>array_values($state['media']),'exportedAt'=>gmdate('c')];
        });respond(200,$snapshot);
    }
}
function handleAccounts(FlatFileStore $store,array $user,string $route,string $method): void {
    if($route==='admins'&&$method==='GET'){
        requirePermission($user,'users.manage');respond(200,['items'=>$store->read(static fn(array $state)=>array_values(array_map('publicUser',$state['users'])))]);
    }
    if($route==='admins'&&$method==='POST'){
        requirePermission($user,'users.manage');$data=input();only($data,['username','email','display_name','password','role','permissions']);
        $username=strtolower(field($data,'username',39));$email=strtolower(field($data,'email',200));$name=field($data,'display_name',120);$password=field($data,'password',200);$role=field($data,'role',12);$perms=permissions($data['permissions']??[]);
        if(!preg_match('/^[a-z0-9][a-z0-9_-]{2,38}$/D',$username)||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)<12||!in_array($role,['admin','mod'],true))fail(422,'ID tối thiểu 3 ký tự; mật khẩu tối thiểu 12 ký tự; email cần hợp lệ.');
        $hash=password_hash($password,PASSWORD_DEFAULT);
        $store->update(static function(array &$state)use($username,$email,$name,$role,$perms,$hash,$user){
            foreach($state['users'] as $account)if($account['username']===$username||$account['email']===$email)fail(409,'ID hoặc email đã tồn tại.');
            $id=$state['users']?max(array_map('intval',array_keys($state['users'])))+1:1;
            $state['users'][$id]=['id'=>$id,'username'=>$username,'email'=>$email,'display_name'=>$name,'password_hash'=>$hash,'role'=>$role,'permissions'=>$perms,'enabled'=>true,'is_primary'=>false,'created_at'=>gmdate('c')];auditState($state,$user,'admin.create',$username);
        });respond(201,['ok'=>true]);
    }
    if(preg_match('~^admins/([1-9][0-9]*)$~D',$route,$m)&&$method==='PATCH'){
        requirePermission($user,'users.manage');$data=input();only($data,['role','enabled','permissions','password']);$role=field($data,'role',12);$perms=permissions($data['permissions']??[]);$password=field($data,'password',200,false);$id=(int)$m[1];
        if(!in_array($role,['admin','mod'],true)||!is_bool($data['enabled']??null)||($password!==''&&strlen($password)<12))fail(422,'Vai trò, trạng thái hoặc mật khẩu không hợp lệ.');$hash=$password!==''?password_hash($password,PASSWORD_DEFAULT):null;
        $store->update(static function(array &$state)use($id,$role,$perms,$data,$hash,$user){
            $target=$state['users'][$id]??null;if(!$target)fail(404,'Không tìm thấy tài khoản.');
            if(($target['is_primary']||$id===$user['id'])&&($role!=='admin'||!$data['enabled']))fail(403,'Không thể tự khóa hoặc hạ quyền admin gốc/tài khoản đang đăng nhập.');
            $target['role']=$role;$target['permissions']=$perms;$target['enabled']=$data['enabled'];if($hash!==null)$target['password_hash']=$hash;$state['users'][$id]=$target;
            foreach($state['sessions'] as $key=>$session)if($session['user_id']===$id)unset($state['sessions'][$key]);auditState($state,$user,'admin.update',(string)$id);
        });respond(200,['ok'=>true]);
    }
    if($route==='auth/password'&&$method==='POST'){
        $data=input();only($data,['currentPassword','password']);$password=field($data,'password',200);$current=field($data,'currentPassword',200);if(strlen($password)<12)fail(422,'Mật khẩu mới tối thiểu 12 ký tự.');
        $store->update(static function(array &$state)use($user,$password,$current){
            if(!password_verify($current,$state['users'][$user['id']]['password_hash']))fail(422,'Mật khẩu hiện tại không đúng.');
            $state['users'][$user['id']]['password_hash']=password_hash($password,PASSWORD_DEFAULT);foreach($state['sessions'] as $key=>$session)if($session['user_id']===$user['id'])unset($state['sessions'][$key]);
        });respond(200,['ok'=>true]);
    }
}
$configFile = getenv('AVECJO_CONFIG') ?: dirname(__DIR__,3).'/avecjo-config.php';
if(!is_file($configFile))fail(503,'API CMS chưa được cấu hình trên hosting PHP.');
try {
    $publicRoot=dirname(__DIR__,2);$configReal=realpath($configFile);$publicReal=realpath($publicRoot);
    if($configReal===$publicReal||str_starts_with($configReal,$publicReal.DIRECTORY_SEPARATOR))throw new RuntimeException('Private config is inside public root.');
    $config=require $configFile;if(!is_array($config)||strlen($config['appKey']??'')<32)fail(503,'Cấu hình API chưa đầy đủ.');
    $origin=$_SERVER['HTTP_ORIGIN']??'';if($origin!==''&&!in_array($origin,$config['allowedOrigins']??[],true))fail(403,'Tên miền không được phép truy cập API.');
    if($origin!==''){header('Access-Control-Allow-Origin: '.$origin);header('Vary: Origin');}
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');header('Access-Control-Allow-Headers: Content-Type, Authorization');header('Access-Control-Max-Age: 600');
    $method=$_SERVER['REQUEST_METHOD']??'GET';if($method==='OPTIONS'){http_response_code(204);exit;}
    $store=new FlatFileStore($config['cmsDataDir']??dirname($configReal).'/avecjo-data',$publicRoot);
    $route=trim($_GET['route']??'health','/');
    if($route==='health'&&$method==='GET')respond(200,['ok'=>true,'service'=>'avecjo-cms','storage'=>'files','contactsConfigured'=>!empty($config['dsn']),'version'=>2]);
    if($route==='leads'&&$method==='POST')handleContacts($store,$config,null,$route,$method);
    if($route==='auth/login'&&$method==='POST'){
        rateLimit($store,$config,'login',15);$data=input();only($data,['identifier','password']);$identifier=strtolower(field($data,'identifier',200));$password=field($data,'password',200);
        $result=$store->update(static function(array &$state)use($identifier,$password):array{
            $account=null;foreach($state['users'] as $candidate)if($candidate['username']===$identifier||$candidate['email']===$identifier){$account=$candidate;break;}
            $valid=password_verify($password,$account['password_hash']??'$2y$12$4Ua9rHauZ7a9M9gq.iL6j.qDs35yp7klH4qjCyV1WFay4yG.DSZ3m');
            if(!$valid||!$account||!$account['enabled'])fail(401,'ID/email hoặc mật khẩu không đúng.');
            foreach($state['sessions'] as $key=>$session)if($session['expires_at']<=time())unset($state['sessions'][$key]);
            $token=rtrim(strtr(base64_encode(random_bytes(32)),'+/','-_'),'=');$state['sessions'][hash('sha256',$token)]=['user_id'=>$account['id'],'expires_at'=>time()+28800];auditState($state,$account,'login',(string)$account['id']);return ['token'=>$token,'user'=>publicUser($account)];
        });respond(200,$result);
    }
    $user=currentUser($store);
    if($route==='auth/me'&&$method==='GET')respond(200,['user'=>$user]);
    if($route==='auth/logout'&&$method==='POST'){$hash=bearerHash();$store->update(static function(array &$state)use($hash){unset($state['sessions'][$hash]);});respond(200,['ok'=>true]);}
    if($route==='stats'||$route==='leads'||str_starts_with($route,'leads/'))handleContacts($store,$config,$user,$route,$method);
    handleAccounts($store,$user,$route,$method);handleContent($store,$user,$route,$method,$config);fail(404,'Không tìm thấy chức năng.');
} catch(Throwable $e){error_log('AvecJo API: '.get_class($e).' code='.$e->getCode());fail(503,'Không kết nối được dịch vụ. Vui lòng thử lại sau.');}
