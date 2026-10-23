function parseStore(raw, mode) {
 try {
  const clean=raw.replace(/^\uFEFF/, '').trim();
  let obj={};
  if (clean) {
   try {
    obj=JSON.parse(clean);
    for(let i=0;i<2 && typeof obj==='string';i++) obj=JSON.parse(obj);
   } catch (_) {
    const line=clean.match(/(?:^|\n)Cookie:\s*([^\r\n]+)/i);
    const cookie=line ? line[1] : clean;
    if (!/(?:^|;)\s*_m_h5_tk=[^;]+/.test(cookie)) throw Error('format');
    const nick=cookie.match(/(?:^|;)\s*_nk_=([^;]+)/);
    if (!nick) throw Error('name');
    const name=decodeURIComponent(nick[1]);
    obj=Object.create(null);obj[name]=cookie;
   }
  }
  if (!obj || Array.isArray(obj) || typeof obj !== 'object') throw Error('format');
  const keys=Object.keys(obj);
  for (const k of keys) {
   if (!k.trim() || ['__proto__','constructor','prototype','undefined','Undefined'].includes(k) ||
       typeof obj[k] !== 'string' || !/(?:^|;)\s*_m_h5_tk=/.test(obj[k])) throw Error('account');
  }
  return {ok:'yes', json:mode==='run' && !keys.length ? '' : JSON.stringify(obj),count:keys.length};
 } catch (_) { return {ok:'no',json:'',count:0}; }
}