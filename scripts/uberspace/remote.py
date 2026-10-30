"""Account-specific deployment control, executed over authenticated SSH stdin.
No passwords in arguments, output, logs, releases or repository files.
"""
import base64, datetime, fcntl, hashlib, json, os, pathlib, re, secrets, subprocess, sys, time
from contextlib import contextmanager
ROOT=pathlib.Path('/var/www/virtual/nf')
HTML=ROOT/'html'
MANAGED=ROOT/'.sandforge'
RELEASES=MANAGED/'releases'
PASSWORD=ROOT/'.htpasswd'
UID=os.getuid()
def require(value,message):
    if not value: raise RuntimeError(message)
def digest(data): return hashlib.sha256(data).hexdigest()
def write_json(target,data,mode=0o600):
    temp=target.with_name(target.name+'.'+secrets.token_hex(6)+'.tmp')
    fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL,mode)
    with os.fdopen(fd,'w') as f: json.dump(data,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
    os.replace(temp,target)
def read_json(target,default=None): return json.loads(target.read_text()) if target.exists() else default
@contextmanager
def lock(name):
    with open(MANAGED/name,'a+') as f:
        os.chmod(MANAGED/name,0o600);fcntl.flock(f,fcntl.LOCK_EX)
        yield

def release_path(name):
    require(isinstance(name,str) and re.fullmatch(r'v-[a-z0-9]+(?:-[a-z0-9]+)+',name) and len(name)<110,'Invalid managed release ID')
    target=RELEASES/name
    require(target.resolve()==target and target.parent==RELEASES,'Unexpected symlink in managed release')
    return target

def current():
    link=HTML/'.current'
    if not link.is_symlink():
        require(not link.exists(),'Current pointer must be a managed symlink');return None
    target=link.resolve();require(target.parent==RELEASES,'Current pointer outside managed releases')
    require(link.lstat().st_uid==UID,'Current pointer owner mismatch')
    return target.name

def inspect(p):
    require(os.environ.get('USER')=='nf' and ROOT.is_dir(),'Unexpected SSH account')
    backends=json.loads(subprocess.check_output(['uberspace','web','backend','list','--json']))
    domains=json.loads(subprocess.check_output(['uberspace','web','domain','list','--json']))
    require(len(backends)==1 and backends[0]['domain'] is None and backends[0]['path']=='/' and backends[0]['destination']=='APACHE','Require exactly the default Apache backend; unsafe side route detected')
    require([d['name'] for d in domains]==['nf.uber.space'],'Unexpected domain set: inspect before deployment')
    require(HTML.is_dir() and not HTML.is_symlink() and (ROOT/'nf.uber.space').resolve()==HTML,'Unexpected DocumentRoot mapping')
    guard=HTML/'.htaccess';require(guard.is_file() and not guard.is_symlink() and guard.stat().st_uid==UID and guard.stat().st_mode & 0o022==0,'Authentication guard missing or writable by others')
    require(PASSWORD.is_file() and not PASSWORD.is_symlink() and PASSWORD.stat().st_uid==UID and PASSWORD.stat().st_mode & 0o007==0,'Password file must be a private account-owned regular file')
    if p.get('guardSHA256'): require(digest(guard.read_bytes())==p['guardSHA256'],'Authentication guard changed; inspect before deployment')
    users=PASSWORD.read_text().splitlines() if PASSWORD.exists() else []
    nobby=any(re.match(r'^nobby:\$2[aby]\$',line) for line in users)
    if p.get('requireNobby',True): require(nobby,'Personal bcrypt password for nobby is not set yet')
    pointer=HTML/'.releases'
    if pointer.exists() or pointer.is_symlink(): require(pointer.is_symlink() and pointer.resolve()==RELEASES and pointer.lstat().st_uid==UID,'Unexpected release-store mapping')
    inventory=sorted((f.relative_to(MANAGED).as_posix(),f.lstat().st_size,f.lstat().st_mtime_ns) for f in MANAGED.rglob('*'))
    protection={'guard':[guard.stat().st_size,guard.stat().st_mtime_ns],'password':[PASSWORD.stat().st_size,PASSWORD.stat().st_mtime_ns],'managed':inventory}
    c=current();manifest=read_json(release_path(c)/'deployment.json') if c else None
    return {'account':'nf','host':'janus.uberspace.de','documentRoot':str(HTML),'apache':True,'domain':'nf.uber.space','nobbyBcrypt':nobby,'current':c,'manifest':manifest,'state':read_json(MANAGED/'state.json',{}),'readOnlySnapshot':protection}

def lease(p):
    with lock('lease.lock'):
        old=read_json(MANAGED/'lease.json')
        require(not old or old['expires']<time.time(),'Another deployment is active; retry after it completes')
        token=secrets.token_hex(24);write_json(MANAGED/'lease.json',{'token':token,'expires':time.time()+3600})
        return {'token':token}
def check_lease(p):
    data=read_json(MANAGED/'lease.json');require(data and secrets.compare_digest(data['token'],p.get('token','')) and data['expires']>time.time(),'Deployment lease is missing or expired')
def unlock(p):
    with lock('lease.lock'):
        check_lease(p);(MANAGED/'lease.json').unlink();return {'unlocked':True}

def verify(p):
    check_lease(p);target=release_path(p['release']);require(target.is_dir(),'Upload missing')
    file=target/'deployment.json';raw=file.read_bytes()
    if p.get('manifestSHA256'):require(digest(raw)==p['manifestSHA256'],'Manifest hash mismatch')
    manifest=json.loads(raw);require(manifest['release']==p['release'],'Release identity mismatch')
    actual=[]
    for base,dirs,files in os.walk(target,followlinks=False):
        for name in dirs+files:require(not (pathlib.Path(base)/name).is_symlink(),'Symlinks forbidden in release payload')
        os.chmod(base,0o755)
        for name in files:
            f=pathlib.Path(base)/name;relative=f.relative_to(target).as_posix();actual.append(relative)
            require(not re.search(r'(^|/)(\.|node_modules)|\.(map|ts|pem|key|md)$',relative),'Nonproduction file in upload')
            os.chmod(f,0o644)
            if relative=='deployment.json':continue
            expected=manifest['files'].get(relative);require(expected is not None,'Unexpected uploaded file')
            require(f.stat().st_size==expected['size'],'Truncated uploaded file: '+relative)
            with open(f,'rb') as data:
                hashed=hashlib.sha256()
                for chunk in iter(lambda:data.read(1024*1024),b''):hashed.update(chunk)
                actual_hash=hashed.hexdigest()
            require(actual_hash==expected['sha256'],'Uploaded content hash mismatch: '+relative)
    require(set(actual)==set(manifest['files'])|{'deployment.json'},'Incomplete uploaded release')
    return {'verified':len(manifest['files']),'release':p['release'],'commit':manifest['commit']}

def switch(target):
    pointer=HTML/'.current'
    if target is None:
        if pointer.is_symlink():pointer.unlink()
        return
    require(release_path(target).is_dir(),'Release missing')
    temp=HTML/('.current-'+secrets.token_hex(6));os.symlink(str(release_path(target)),temp);os.replace(temp,pointer)
def prepare(p):
    check_lease(p);inspect(p)
    target=release_path(p['release']);require(not target.exists(),'Release ID already exists; refusing overwrite')
    target.mkdir(mode=0o755)
    store=HTML/'.releases'
    if not store.is_symlink():os.symlink(str(RELEASES),store)
    return {'staging':str(target),'current':current()}
def activate(p):
    check_lease(p);inspect(p);require(current()==p.get('expected'),'Active release changed during deployment')
    verify(p)
    store=HTML/'.releases'
    if not store.is_symlink():os.symlink(str(RELEASES),store)
    before=current();switch(p['release'])
    return {'previous':before,'current':current()}
def restore(p):
    check_lease(p);require(current()==p['failed'],'Refusing rollback over another activation')
    if p.get('previous'):release_path(p['previous'])
    switch(p.get('previous'))
    if 'previousState' in p:write_json(MANAGED/'state.json',p['previousState'])
    return {'current':current(),'restored':True}
def commit(p):
    check_lease(p);require(current()==p['release'],'Activation changed before verification completed')
    old=read_json(MANAGED/'state.json',{});history=old.get('history',[])
    history.append({'release':p['release'],'previous':p.get('previous'),'at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
    write_json(MANAGED/'state.json',{'current':p['release'],'previous':p.get('previous'),'history':history[-100:]})
    return {'committed':p['release'],'previous':p.get('previous')}

def write_passwords(lines):
    temp=ROOT/('.htpasswd-'+secrets.token_hex(8)+'.tmp')
    fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f:f.write('\n'.join(lines)+'\n');f.flush();os.fsync(f.fileno())
    subprocess.run(['setfacl','-m','g:www:r',str(temp)],check=True,capture_output=True)
    os.replace(temp,PASSWORD)
def probe(p):
    inspect(p)
    username=p['username'];require(re.fullmatch(r'__sandforge_check_[a-f0-9]{16}',username),'Invalid temporary probe name');password=secrets.token_urlsafe(40)
    hashed=subprocess.run(['htpasswd','-n','-i','-B','-C','8',username],input=password+'\n',capture_output=True,text=True,check=True).stdout.strip()
    require(hashed.startswith(username+':$2'),'Bcrypt probe generation failed')
    with lock('auth.lock'):
        lines=PASSWORD.read_text().splitlines();write_passwords(lines+[hashed])
    return {'username':username,'password':password}
def unprobe(p):
    username=p['username'];require(re.fullmatch(r'__sandforge_check_[a-f0-9]{16}',username),'Invalid temporary probe name')
    with lock('auth.lock'):
        lines=PASSWORD.read_text().splitlines();write_passwords([line for line in lines if not line.startswith(username+':')])
    return {'removed':True}

ACTIONS={'inspect':inspect,'lease':lease,'unlock':unlock,'verify':verify,'prepare':prepare,'activate':activate,'restore':restore,'commit':commit,'probe':probe,'unprobe':unprobe}
if __name__=='__main__':
    try:
        data=json.load(sys.stdin);result=ACTIONS[sys.argv[1]](data);print(json.dumps(result))
    except Exception as error:
        print(json.dumps({'error':str(error)}));sys.exit(1)
