// One continuous slide: the incoming page exists before the gesture starts.
export class PageSlide{
 constructor(surface,incoming,{direction=1,back=false}={}){
  this.direction=direction;this.back=back;this.x=0;this.surface=surface;
  const r=surface.getBoundingClientRect(),nav=document.querySelector('#daily nav')?.getBoundingClientRect();this.width=r.width;
  const layer=document.createElement('div');layer.className='motion-viewport';layer.setAttribute('aria-hidden','true');layer.inert=true;
  Object.assign(layer.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:Math.max(0,Math.min(Math.max(r.height,incoming.scrollHeight||r.height), (nav?.top||innerHeight)-r.top))+'px'});
  const old=surface.cloneNode(true);this.old=old;this.next=incoming;this.layer=layer;
  for(const n of [old,incoming]){n.querySelector('nav')?.remove();n.removeAttribute('id');n.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));n.classList.add('motion-page');n.style.margin='0';n.style.width=r.width+'px';n.style.minHeight=r.height+'px';n.style.transform='';}
  layer.append(incoming,old);document.getElementById('daily').append(layer);this.originalVisibility=surface.style.visibility;this.nav=surface.querySelector('nav');this.navVisibility=this.nav?.style.visibility;surface.style.visibility='hidden';if(this.nav)this.nav.style.visibility='visible';this.paint(0);
 }
 paint(x){this.x=x;const w=this.width,d=this.direction;this.old.style.transform=`translate3d(${x}px,0,0)`;this.next.style.transform=`translate3d(${this.back?-w*.25+x*.25:d*w+x}px,0,0)`;}
 async finish(commit){const target=commit?-this.direction*this.width:0,distance=Math.abs(target-this.x),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.max(160,Math.min(340,340*distance/this.width));const from=this.x,backFrom=this.back?-this.width*.25+from*.25:this.direction*this.width+from,backTo=this.back?-this.width*.25+target*.25:this.direction*this.width+target;
  const options={duration,easing:'cubic-bezier(.22,.72,.18,1)',fill:'forwards'};
  await Promise.all([this.old.animate([{transform:`translate3d(${from}px,0,0)`},{transform:`translate3d(${target}px,0,0)`}],options).finished.catch(()=>{}),this.next.animate([{transform:`translate3d(${backFrom}px,0,0)`},{transform:`translate3d(${backTo}px,0,0)`}],options).finished.catch(()=>{})]);
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.surface.style.visibility=this.originalVisibility;if(this.nav)this.nav.style.visibility=this.navVisibility;this.layer.remove();}
}
