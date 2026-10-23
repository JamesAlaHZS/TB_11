"""Fetch known upstream resources, sanitize, validate everything, then update the mirror."""
import argparse, base64, concurrent.futures, hashlib, json, os, re, subprocess, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
POLICY = json.loads((ROOT/'maintenance/policy.json').read_text(encoding='utf8'))
RAW = POLICY['raw_base']
RED = POLICY['campaigns']['red']['mobile'].rsplit('.', 1)[1]
CART = POLICY['campaigns']['cart']['mobile'].rsplit('.', 1)[1]
LABELS = {'去我的小店看看':'TG-ala 入口','美团红包':'TG-ala 红包入口','饿了么红包':'TG-ala 活动入口',
          '淘礼金情报群':'ala 交流群','助力.交流 qq群':'ala 交流群 1095180136',
          '交流·反馈 qq群':'交流·反馈 1095180136','双十一助力群':'双十一交流 1095180136',
          '淘金币及遇到问题点我':'ala 使用说明'}

def digest(b): return hashlib.sha256(b).hexdigest()
def text_replace(s, path=''):
    if s in LABELS: return LABELS[s]
    if s.startswith(('imeituan://','eleme://','https://ktt.pinduoduo.com/')):
        return 'taobao://m.tb.cn/h.'+RED
    if s.startswith('mqqapi://'):
        return re.sub(r'(?<=uin=)\d+',POLICY['qq_group'],s)
    if s.startswith('https://www.icloud.com/shortcuts/'):
        return POLICY['no_ck_shortcut_url'] if '无需ck' in path.lower() else 'https://github.com/'+POLICY['repository']+'/tree/main/shortcuts'
    if s.startswith('https://mp.weixin.qq.com/') and s not in POLICY['video_urls']:
        return 'https://github.com/'+POLICY['repository']+'#readme'
    if s.startswith(POLICY['upstream_base']):
        name=s[len(POLICY['upstream_base']):]
        matched=[r for r in POLICY['resources'] if r['source']==name]
        if len(matched)!=1: raise ValueError('Unrecognized upstream dependency: '+name)
        return RAW+matched[0]['target']
    return re.sub(r'(m\.tb\.cn/h\.)[A-Za-z0-9]+',lambda m:m[1]+(CART if any(k in path for k in ['购物车','gwc']) else RED),s)

def clean_json(obj,path='$'):
    if isinstance(obj,dict):
        result={}
        for k,v in obj.items():
            new_key=text_replace(k,path)
            if new_key in result: raise ValueError('Replacement would collide with a JSON key')
            result[new_key]=clean_json(v,path+'.'+k)
        return result
    if isinstance(obj,list):return [clean_json(v,path+f'[{i}]') for i,v in enumerate(obj)]
    if isinstance(obj,str):return text_replace(obj,path)
    return obj

def leaves(obj,path='$'):
    if isinstance(obj,dict):
        for k,v in obj.items():yield from leaves(v,path+'.'+k)
    elif isinstance(obj,list):
        for i,v in enumerate(obj):yield from leaves(v,path+f'[{i}]')
    else:yield path,obj

def customize_activity(obj):
    """Apply the user's menu policy after validating the underlying task structure."""
    def walk(value):
        if isinstance(value,dict):
            for key in list(value):
                if '视频教程' in key:
                    del value[key]
                    continue
                if key=='list' and isinstance(value[key],list):
                    value[key]=[v for v in value[key] if not (isinstance(v,str) and '视频教程' in v)]
                if key=='tip' and isinstance(value[key],str):
                    value[key]=value[key].replace('遇到问题点视频教程','进群获取教程').replace('抓不到包的去视频教程下拉','进群获取教程').replace('不会取cookie的点下面的获取cookie','进群获取教程')
                    lines=value[key].splitlines();seen=False;kept=[]
                    for line in lines:
                        if '视频教程' in line:continue
                        if line.strip()=='进群获取教程':
                            if seen:continue
                            seen=True
                        kept.append(line)
                    value[key]='\n'.join(kept)
                walk(value[key])
        elif isinstance(value,list):
            for v in value:walk(v)
    walk(obj['activity'])
    tip=obj['activity'].get('tip','').rstrip()
    if '进群获取教程' not in tip:tip+='\n进群获取教程'
    obj['activity']['tip']=tip
    for key,value in obj['activity'].get('mapping',{}).items():
        if '无需ck' in key.lower() and isinstance(value,dict):value['url']=POLICY['no_ck_shortcut_url']
    return obj

def checked_json(source):
    obj=json.loads(source)
    result=clean_json(obj)
    result['activity']['tip']=POLICY['signature']+'\nQQ群：'+POLICY['qq_group']+'\n'+result['activity']['tip']
    # All containers, scalar types, and non-text values survive intact.
    def structural(a,b):
        if type(a) is not type(b):raise ValueError('JSON type changed')
        if isinstance(a,dict):
            if len(a)!=len(b):raise ValueError('JSON keys removed')
            for (_,v),(_,w) in zip(a.items(),b.items()):structural(v,w)
        elif isinstance(a,list):
            if len(a)!=len(b):raise ValueError('JSON list length changed')
            for v,w in zip(a,b):structural(v,w)
        elif not isinstance(a,str) and a!=b:raise ValueError('Non-text task parameter changed')
    structural(obj,result)
    return customize_activity(result)

def js_clean(source):
    def sub(m):return m[1]+(CART if m[2]=='gStr' else RED)+m[4]
    result,count=re.subn(r"(var\s+(pvStr|endStr|gStr)\s*=\s*(['\"]))[^'\"]+(['\"])",sub,source)
    if not count:raise ValueError('Missing campaign declarations')
    result='// '+POLICY['signature']+' | QQ群：'+POLICY['qq_group']+'\n'+result
    return result

def ast_check(source,target):
    done=subprocess.run([os.environ.get('NODE_BINARY','node'),str(ROOT/'maintenance/ast.cjs')],
                        input=json.dumps({'source':source,'target':target}),text=True,encoding='utf8',capture_output=True,check=True)
    return json.loads(done.stdout)['sha256']

def suspicious(s):
    s=s.replace(POLICY['no_ck_shortcut_url'],'<OWN_SHORTCUT>')
    for needle in ['jiutiao','九条','963696474','2165017168','884282432','714153240','596783999',
                   'imeituan://','eleme://','pinduoduo.com','inviterId=','click.meituan.com','www.icloud.com/shortcuts/']:
        if needle in s:raise ValueError('Unreplaced destination: '+needle)
    for code in re.findall(r'm\.tb\.cn/h\.([A-Za-z0-9]+)',s):
        if code not in [RED,CART]:raise ValueError('Unapproved campaign: '+code)
    # Decode URL-bearing base64 and percent escapes before the same audit.
    for candidate in re.findall(r'[A-Za-z0-9+/=]{32,}',s):
        try:decoded=base64.b64decode(candidate,validate=True).decode('utf8')
        except (ValueError,UnicodeDecodeError):continue
        if re.search(r'https?[:/]|m\.tb\.cn|qq\.com',decoded):raise ValueError('Unexpected encoded URL')
    from urllib.parse import unquote
    decoded=unquote(s)
    if decoded!=s:suspicious(decoded)

def network_text(url):
    request=Request(url,headers={'User-Agent':'TB11-ala-resource-sync/1.0','Cache-Control':'no-cache'})
    for attempt in range(3):
        try:
            with urlopen(request,timeout=35) as r:
                if r.status!=200:raise ValueError('Unexpected HTTP status')
                raw=r.read(1024*1024+1)
            break
        except (HTTPError,URLError,TimeoutError) as error:
            if isinstance(error,HTTPError) and error.code not in [418,429,500,502,503,504]:raise
            if attempt==2:raise
            time.sleep([3,10][attempt])
    if len(raw)>1024*1024:raise ValueError('Upstream resource too large')
    return raw.decode('utf-8-sig')

def run(snapshot=None,initialize=False,check=False):
    def fetch(r):
        if snapshot:
            if r['kind']=='json':
                index=0 if 'tb26618' in r['source'] else 1
                return Path(snapshot).parent.joinpath('originals',str(index)+'.config.raw').read_text(encoding='utf-8-sig')
            return (Path(snapshot)/r['source']).read_text(encoding='utf-8-sig')
        return network_text(POLICY['upstream_base']+r['source'])
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        sources=list(pool.map(fetch,POLICY['resources']))
    baseline_path=ROOT/'maintenance/baseline.json'
    baseline={} if initialize else json.loads(baseline_path.read_text(encoding='utf8'))
    outputs={}; current={}; approved={}
    for resource,source in zip(POLICY['resources'],sources):
        target=resource['target']; record={'source_sha256':digest(source.encode())}
        if resource['kind']=='json':
            obj=checked_json(source)
            # URL fields remain approved verbatim after sanitizing. New endpoint locations require review.
            urlmap={p:v for p,v in leaves(obj) if isinstance(v,str) and re.search(r'://|https?%3A',v,re.I)}
            if not initialize and urlmap!=baseline[target]['urls']:raise ValueError('New or changed JSON endpoint: '+target)
            def shape(value,key=''):
                if key in ['item','ckItem','outItem'] and isinstance(value,list):return '<task-items>'
                if isinstance(value,dict):return {k:shape(v,k) for k,v in value.items()}
                if isinstance(value,list):return [shape(v) for v in value]
                return type(value).__name__
            shape_hash=digest(json.dumps(shape(obj),sort_keys=True).encode())
            display={p:v for p,v in leaves(obj.get('activity',{})) if isinstance(v,str)}
            if not initialize and (shape_hash!=baseline[target]['shape_sha256'] or display!=baseline[target]['display']):
                raise ValueError('Upstream menu or display fields changed; review required: '+target)
            # urlArr is a POST list; a newly populated value must never be silently accepted.
            if obj.get('urlArr')!=[]:raise ValueError('New upstream POST destination')
            result=json.dumps(obj,ensure_ascii=False,indent=2)+'\n'
            approved[target]={'urls':urlmap,'shape_sha256':shape_hash,'display':display}
            backup=target.replace('.json','-backup.json')
            outputs[backup]=result
        else:
            result=js_clean(source)
            ast_hash=ast_check(source,result)
            if not initialize and ast_hash!=baseline[target]['ast_sha256']:raise ValueError('Upstream script logic changed; review required: '+target)
            url_tokens=sorted(set(re.findall(r"(?:[a-z]+://|https?%3A)[^\s'\"<>`]+",result)))
            if not initialize and url_tokens!=baseline[target]['url_tokens']:raise ValueError('New script or comment URL; review required: '+target)
            approved[target]={'ast_sha256':ast_hash,'url_tokens':url_tokens}
        suspicious(result)
        outputs[target]=result
        record['sanitized_sha256']=digest(result.encode());current[target]=record
    # Nothing is written until every resource passes; failure retains all published resources.
    if check:
        for path,value in outputs.items():
            if (ROOT/path).read_text(encoding='utf8')!=value:raise ValueError('Mirror differs: '+path)
        print('All mirrored resources match sanitized upstream');return
    for path,value in outputs.items():
        p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(value,encoding='utf8',newline='\n')
    manifest={'resources':current}
    (ROOT/'maintenance/sync-state.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    if initialize:baseline_path.write_text(json.dumps(approved,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'validated_resources':len(sources),'written_files':len(outputs)},ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--snapshot');p.add_argument('--initialize',action='store_true');p.add_argument('--check',action='store_true')
    args=p.parse_args();run(args.snapshot,args.initialize,args.check)
