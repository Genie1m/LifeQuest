/** Next dev may rewrite request.url to localhost. Host is the browser-facing authority. */
export function localRequestError(request:Request):string|null {
 const rawOrigin=request.headers.get('origin');const host=request.headers.get('host');
 if(!rawOrigin)return '缺少 Origin，请从本机 LifeQuest 页面发起请求。';
 if(!host||!/^(localhost|127\.0\.0\.1|\[::1\])(?::[1-9]\d{0,4})?$/i.test(host))return 'Host 必须是 localhost、127.0.0.1 或 [::1] 的本机地址。';
 try{
  const origin=new URL(rawOrigin);
  if(!['http:','https:'].includes(origin.protocol)||origin.origin!==rawOrigin)return 'Origin 格式无效，请使用本机页面。';
  const authority=new URL(`${origin.protocol}//${host}`);
  if(!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)||origin.origin!==authority.origin)return 'Origin 与 Host 的地址或端口不一致，请统一使用浏览器地址栏中的本机地址。';
 }catch{return 'Origin 或 Host 格式无效。';}
 if(request.headers.get('sec-fetch-site')==='cross-site')return '拒绝跨站模型请求。';
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return '模型接口仅接受 application/json 请求。';
 return null;
}
