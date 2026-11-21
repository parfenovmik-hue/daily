import test from 'node:test';
import assert from 'node:assert/strict';
import {extractProduct,productURL,publicAddress,readPublicPage} from '../../backend/supabase/functions/_shared/product.mjs';
test('Server product reader extracts sourced product/service metadata and avoids variant price guesses',()=>{
 const page='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Exact product',image:'/item.webp',offers:{price:'12300',priceCurrency:'RUB'}})+'</script>';
 assert.deepEqual(extractProduct(page,'https://shop.example/item'),{productTitle:'Exact product',image:'https://shop.example/item.webp',price:12300,currency:'RUB'});
 const variants='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Item',offers:[{price:100,priceCurrency:'RUB'},{price:200,priceCurrency:'RUB'}]})+'</script>';
 assert.equal(extractProduct(variants,'https://shop.example/item').price,0);
 assert.throws(()=>extractProduct('<title>Access denied</title>','https://shop.example/'),/ограничивает/);
 assert.equal(extractProduct('<meta content="Service &amp; title" property="og:title">','https://shop.example/').productTitle,'Service & title');
});
test('Public reader rejects internal URLs/DNS/redirects, oversized bodies and unsupported content',async()=>{
 for(const url of ['http://shop.example/','https://127.0.0.1/','https://user:pass@shop.example/','https://a.local/','https://[::1]/'])assert.equal(productURL(url),'');
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
 let requested=0;const resolve=async()=>['93.184.216.34'];
 await assert.rejects(readPublicPage('https://shop.example/',{resolve:async()=>['127.0.0.1'],transport:async()=>{requested++;}}),/недоступен/);
 assert.equal(requested,0);
 await assert.rejects(readPublicPage('https://shop.example/',{resolve,transport:async()=>new Response('',{status:302,headers:{location:'https://127.0.0.1/'}})}),/публичная/);
 await assert.rejects(readPublicPage('https://shop.example/',{resolve,limit:3,transport:async()=>new Response('huge',{headers:{'content-type':'text/html'}})}),/большая/);
 await assert.rejects(readPublicPage('https://shop.example/',{resolve,transport:async()=>new Response('x',{headers:{'content-type':'application/pdf'}})}),/страница/);
});
