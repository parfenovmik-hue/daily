import DailyClient from './client';
import {getChatGPTUser,chatGPTSignInPath} from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Home(){const user=await getChatGPTUser();if(!user)return <main className="signin"><h1>Daily</h1><p>Твои дела, цели и маленькие победы.</p><a href={chatGPTSignInPath('/')} target="_top">Войти через ChatGPT</a></main>;return <DailyClient account={user.userId} name={user.displayName}/>;}
