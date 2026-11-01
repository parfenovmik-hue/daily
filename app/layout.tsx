import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Daily',description:'Дела, цели и маленькие победы.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,statusBarStyle:'default',title:'Daily'},icons:{icon:'/icon.svg',apple:'/apple-touch-icon.png'}};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#f5f6f6'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ru"><body>{children}</body></html>;}
