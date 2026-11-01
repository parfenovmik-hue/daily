'use client';
import {useEffect} from 'react';
export default function DailyClient({account,name}:{account:string;name:string}){
 useEffect(()=>{const s=document.createElement('script');s.type='module';s.src='/daily.js';document.body.appendChild(s);return()=>{s.remove();};},[]);
 return <div id="daily" data-account={account} data-name={name} suppressHydrationWarning><p className="loading">Открываем Daily…</p></div>;
}
