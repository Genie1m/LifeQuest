import {afterEach,describe,it,expect,vi} from 'vitest';
import {localRequestError} from './local-request';
import {POST} from '@/app/api/planner/route';
function request(origin:string|null='http://127.0.0.1:3000',host:string|null='127.0.0.1:3000',contentType='application/json'){
 const headers=new Headers({'content-type':contentType});if(origin!==null)headers.set('origin',origin);if(host!==null)headers.set('host',host);
 return new Request('http://localhost:3000/api/planner',{method:'POST',headers,body:'{}'});
}
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
describe('browser-facing loopback origin checks',()=>{
 it.each(['127.0.0.1','localhost','[::1]'])('accepts same-origin %s despite Next internal URL rewriting',host=>{expect(localRequestError(request(`http://${host}:3000`,`${host}:3000`))).toBeNull();});
 it.each([
  ['http://localhost:3000','127.0.0.1:3000'],['http://127.0.0.1:3001','127.0.0.1:3000'],['https://evil.example','evil.example'],['http://127.0.0.1.evil.example:3000','127.0.0.1:3000'],['null','127.0.0.1:3000'],['http://user:pass@127.0.0.1:3000','127.0.0.1:3000'],['http://127.0.0.1:3000/path','127.0.0.1:3000'],['http://127.0.0.1:3000','127.0.0.1:99999'],[null,'127.0.0.1:3000'],['http://127.0.0.1:3000',null]
 ])('rejects origin %s with host %s', (origin,host)=>{expect(localRequestError(request(origin,host))).not.toBeNull();});
 it('rejects non-JSON and explicit cross-site fetches',()=>{expect(localRequestError(request(undefined,undefined,'text/plain'))).toContain('application/json');const r=request();r.headers.set('sec-fetch-site','cross-site');expect(localRequestError(r)).toContain('跨站');});
 it('does not trust forwarded headers as an origin override',()=>{const r=request('https://evil.example','evil.example');r.headers.set('x-forwarded-host','127.0.0.1:3000');expect(localRequestError(r)).not.toBeNull();});
 it('passes the actual route origin guard with no key and zero supplier requests',async()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('LIFEQUEST_ENABLE_REAL_LLM','true');const network=vi.spyOn(globalThis,'fetch');const r=await POST(request());expect(r.status).toBe(400);expect(await r.json()).toMatchObject({code:'authentication'});expect(network).not.toHaveBeenCalled();});
 it('keeps production blocked before supplier calls',async()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('LIFEQUEST_ENABLE_REAL_LLM','true');const network=vi.spyOn(globalThis,'fetch');expect((await POST(request())).status).toBe(403);expect(network).not.toHaveBeenCalled();});
});
