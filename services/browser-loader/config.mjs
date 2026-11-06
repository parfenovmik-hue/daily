import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function settings(env=process.env,platform=process.platform,uid=process.getuid?.()){
 if(platform==='linux'&&uid===0)throw Error('Run browser-loader as an unprivileged Linux user; sandbox must stay enabled.');
 if(platform==='linux'&&env.DAILY_READER_PROXY_DNS==='1')throw Error('Local proxy DNS mode is forbidden on Linux.');
 const port=Number(env.DAILY_READER_PORT||8841);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
 const state=path.resolve(env.DAILY_READER_STATE_DIR||fileURLToPath(new URL('../../private/',import.meta.url)));
 return {port,state,connection:path.join(state,'browser-loader-connection.json'),artifacts:path.join(state,'browser-loader'),
  channel:env.DAILY_READER_CHANNEL||(platform==='darwin'?'chrome':'chromium'),headless:env.DAILY_READER_HEADED!=='1',
  tokenFile:env.DAILY_READER_TOKEN_FILE||'',proxyDNS:env.DAILY_READER_PROXY_DNS==='1'};
}
export function launchOptions(config){return {headless:config.headless,channel:config.channel,chromiumSandbox:true,timeout:20000};}
