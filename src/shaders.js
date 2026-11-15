export const SURF = 10;
export const NB = 160, NP = 3200;
export const COMMON = /*wgsl*/`
struct G{vp:mat4x4f,svp:mat4x4f,cam:vec4f,sun:vec4f,res:vec4f,cr:vec4f,cu:vec4f,cf:vec4f};
@group(0)@binding(0)var<uniform>g:G;
@group(0)@binding(1)var smp:sampler;
@group(0)@binding(2)var nzT:texture_2d<f32>;
@group(0)@binding(3)var caT:texture_2d<f32>;
@group(0)@binding(4)var shT:texture_depth_2d;
@group(0)@binding(5)var shS:sampler_comparison;
const SURF=${SURF}.;
fn qa(w:f32)->f32{return round(w*651.8986)/651.8986;}
fn ql(v:f32)->f32{return round(v*4096.)/4096.;}

const EXT=vec3f(.095,.04,.031);
fn rays(rd:vec3f)->f32{
  let s=g.sun.xyz;
  let ax=normalize(cross(s,vec3f(0.,0.,1.)));
  let az=cross(ax,s);
  let a=atan2(dot(rd,az),dot(rd,ax))/6.2832;
  let t=g.cam.w;
  let n1=textureSampleLevel(nzT,smp,vec2f(a*9.,t*ql(.009)),0.).g;
  let n2=textureSampleLevel(nzT,smp,vec2f(a*26.+.3,.5-t*ql(.015)),1.5).r;
  let r=smoothstep(.2,.9,n1*.5+n2*.5);return r*sqrt(r)*.62;
}
fn fogc(rd:vec3f)->vec3f{
  let y=rd.y;
  var c=mix(vec3f(.004,.075,.3),vec3f(.03,.46,.62),smoothstep(-.02,.6,y));
  c=mix(c,vec3f(.002,.03,.14),smoothstep(-.02,.7,-y));
  let sd=max(dot(rd,g.sun.xyz),0.);
  c+=vec3f(.05,.3,.33)*sd*sd*sd;
  c+=vec3f(.1,.4,.4)*rays(rd)*smoothstep(-.45,.55,y)*(.2+sd);
  return c;
}
fn fogk(c:vec3f,wp:vec3f,k:f32)->vec3f{
  let v=wp-g.cam.xyz;let d=length(v);
  let T=exp(-d*k*EXT);
  return c*T+fogc(v/d)*(1.-T);
}
fn fog(c:vec3f,wp:vec3f)->vec3f{return fogk(c,wp,1.);}
fn shadow(wp:vec3f,n:vec3f)->f32{
  let sp=g.svp*vec4f(wp+n*.08,1.);
  let uv=sp.xy*vec2f(.5,-.5)+.5;
  let z=sp.z-.0012;
  let e=1.7/2048.;
  var s=textureSampleCompareLevel(shT,shS,uv+vec2f(-e,-e),z)+textureSampleCompareLevel(shT,shS,uv+vec2f(e,-e),z)+textureSampleCompareLevel(shT,shS,uv+vec2f(-e,e),z)+textureSampleCompareLevel(shT,shS,uv+vec2f(e,e),z);
  let f=max(abs(uv.x-.5),abs(uv.y-.5));
  return mix(s*.25,1.,smoothstep(.44,.5,f));
}
fn caus(wp:vec3f)->vec3f{
  let L=g.sun.xyz;
  let uv=(wp.xz-L.xz*(wp.y/L.y))/2.9;
  let o=vec2f(.0006,.0003);
  let c=min(vec3f(textureSampleLevel(caT,smp,uv+o,0.).r,textureSampleLevel(caT,smp,uv,0.).r,textureSampleLevel(caT,smp,uv-o,0.).r),vec3f(1.8));
  let m=textureSampleLevel(caT,smp,vec2f(uv.x*.8-uv.y*.6,uv.x*.6+uv.y*.8)*.37+.2,0.).r;
  return c*(.45+.55*m);
}
fn lit(base:vec3f,n0:vec3f,wp:vec3f,ao:f32,sp:f32)->vec3f{
  let L=g.sun.xyz;let vv=g.cam.xyz-wp;let d=length(vv);let V=vv/d;
  let n=n0*(smoothstep(-.14,.14,dot(n0,V))*2.-1.);
  let ndl=dot(n,L);
  let ca=mix(vec3f(1.),.58+.45*caus(wp),exp(-d*.045)*smoothstep(.25,.8,ndl));
  let sh=shadow(wp,n);
  let dif=clamp((ndl+.3)/1.3,0.,1.)*smoothstep(-.05,.35,ndl+.3*sp+f32(d>60.));
  let sun=vec3f(1.25,1.18,1.)*dif*sh*ca;
  let amb=mix(vec3f(.08,.16,.25),vec3f(.2,.42,.52),n.y*.5+.5)*ao*(.7+.3*ca);
  var c=base*min(sun+amb,vec3f(1.75));
  let h=normalize(L+V);
  c+=sp*pow(max(dot(n,h),0.),48.)*sh*vec3f(1.6,1.6,1.4);
  let fr=pow(1.-max(dot(n,V),0.),3.);
  c+=base*fr*vec3f(.1,.24,.3)*ao;
  return c;
}
`;

export const SCENE = /*wgsl*/`
// ---------- background
struct BV{@builtin(position)p:vec4f,@location(0)uv:vec2f};
@vertex fn vb(@builtin(vertex_index)i:u32)->BV{
  let q=vec2f(f32((i<<1u)&2u),f32(i&2u))*2.-1.;
  return BV(vec4f(q,1.,1.),q);
}
@fragment fn fb(i:BV)->@location(0)vec4f{
  let rd=normalize(g.cf.xyz+g.cr.xyz*i.uv.x*g.res.z*g.res.w+g.cu.xyz*i.uv.y*g.res.z);
  let c=fogc(rd);
  let t=g.cam.w;
  let d=(SURF-g.cam.y)/max(rd.y,.002);
  let p=g.cam.xz+rd.xz*d;
  let w1=textureSampleLevel(nzT,smp,p*.045+vec2f(t*ql(.011),t*ql(.006)),0.);
  let w2=textureSampleLevel(nzT,smp,p*.17-vec2f(t*ql(.021),t*ql(-.013)),0.);
  let w3=textureSampleLevel(nzT,smp,p*.6+vec2f(t*ql(.03),t*ql(-.04)),0.);
  let n=normalize(vec3f((w1.g-.5)*.04+(w2.r-.5)*.09+(w3.r-.5)*.3,-1.,(w1.r-.5)*.04+(w2.g-.5)*.09+(w3.g-.5)*.3));
  let rf=refract(rd,n,1.333);
  let ci=-dot(rd,n);let tir=1.-smoothstep(.662,.69,ci);
  let sd=max(dot(rf,g.sun.xyz),0.);let cz=min(textureSampleLevel(caT,smp,p*vec2f(.8,.36)+n.xz*.5+vec2f(t*ql(.01),0.),0.).r,2.5)*.3+.7;let sky=vec3f(.2,.62,.86)*(.55+.5*ci)*(.75+.3*cz)+vec3f(1.,.95,.8)*(14.*pow(sd,200.)+.9*pow(sd,10.)*(.6+.4*cz));
  let rl=reflect(rd,n);
  let refl=fogc(vec3f(rl.x,-abs(rl.y),rl.z))*(.45+.4*cz)+vec3f(.02,.12,.16)*cz*.5;
  let sc=mix(sky,refl+vec3f(.05,.3,.36)*smoothstep(.55,.68,ci),tir);
  let T=exp(-d*EXT*1.25);
  return vec4f(mix(c,sc*T+c*(1.-T),smoothstep(0.,.03,rd.y)),1.);
}
// ---------- static
struct SV{@builtin(position)p:vec4f,@location(0)w:vec3f,@location(1)n:vec3f,@location(2)c:vec3f,@location(3)m:vec2f};
fn sway(p:vec3f,w:f32)->vec3f{
  let t=g.cam.w;let ph=p.x*.35+p.z*.27;
  let s=sin(t*qa(.9)+ph)+.35*sin(t*qa(2.3)+ph*2.7+p.y*2.);
  return p+vec3f(s,-.2*abs(s),.5*cos(t*qa(.7)+ph*1.3))*w;
}
@vertex fn vs(@location(0)p:vec3f,@location(1)n:vec3f,@location(2)c:vec4f,@location(3)m:vec2f)->SV{
  let w=sway(p,c.w);
  return SV(g.vp*vec4f(w,1.),w,n,c.rgb,m);
}
@vertex fn vsS(@location(0)p:vec3f,@location(2)c:vec4f)->@builtin(position)vec4f{
  return g.svp*vec4f(sway(p,c.w),1.);
}
fn tri(p:vec3f,n:vec3f,s:f32)->vec4f{
  let w0=pow(abs(n),vec3f(4.));let w=w0/(w0.x+w0.y+w0.z);
  return textureSample(nzT,smp,p.yz*s)*w.x+textureSample(nzT,smp,p.xz*s)*w.y+textureSample(nzT,smp,p.xy*s)*w.z;
}
@fragment fn fs(i:SV)->@location(0)vec4f{
  var n=normalize(i.n);
  let wp=i.w;
  let d=distance(wp,g.cam.xyz);
  let a=textureSample(nzT,smp,wp.xz*.13+wp.y*.07);
  let b=tri(wp,n,1.3);
  let e0=tri(wp,n,5.5);
  let k2=exp(-d*.22);let e=mix(vec4f(.5),e0,exp(-d*.07));let e2=mix(vec4f(.5),tri(wp+vec3f(.37,.11,.53),n,4.7),k2);
  var c=i.c;
  let mt=i.m.x;
  var sp=0.;
  if(mt<1.5){
    let rp=dot(wp.xz,vec2f(.35,.94))*24.+a.g*2.5+b.r*1.5;
    let k=exp(-d*d*.011)*smoothstep(.8,.96,n.y)*smoothstep(.12,.3,(g.cam.y-wp.y)/d);
    let ns=normalize(n+vec3f(.35,0.,.94)*cos(rp)*.25*k);
    let cs=c*(.78+.28*a.r+.12*sin(rp)*k)*(.84+.32*mix(.5,e.a,k2))*(.8+.4*e2.a);
    var cr=c*(.75+.4*b.r)*(.75+.5*e.r);
    cr=mix(cr,vec3f(.5,.2,.3)*(.6+.6*e.g),smoothstep(.5,.7,b.g)*.16);
    cr=mix(cr,vec3f(.2,.3,.13)*(.6+.6*e.r),smoothstep(.52,.72,b.b)*.12);
    cr*=(.82+.3*mix(.5,e.b,sqrt(k2)))*(.7+.6*e2.a);
    let w=clamp(mt,0.,1.);
    c=mix(cs,cr,w);n=normalize(mix(ns+(e2.rgb-.5)*.25,n+(e.rgb-.5)*.6+(e2.rgb-.5)*.5,w));
  }else if(mt<2.5){
    n=normalize(n+(e.rgb-.5)*.05);
    c*=(.9+.2*e.b)*(.9+.2*b.g);
  }else{
    let gr=.5+.5*sin(b.b*60.+b.r*9.);
    n=normalize(n+(b.rgb-.5)*.5+(e.rgb-.5)*.3);
    c=mix(c*.6,c*1.1,smoothstep(.1,.9,gr))*(.85+.3*b.r);
  }
  return vec4f(fog(lit(c,n,wp,i.m.y,sp),wp),1.);
}
// ---------- fish
struct FV{@builtin(position)p:vec4f,@location(0)w:vec3f,@location(1)n:vec3f,@location(2)u:vec4f,@location(3)@interpolate(flat)k:vec2f};
fn pth(a:vec4f,b:vec4f,c:vec4f,th:f32)->vec3f{
  let lx=b.x*cos(th);let lz=b.y*sin(th*b.z+b.w);
  let cy=cos(a.w);let sy=sin(a.w);
  return a.xyz+vec3f(lx*cy-lz*sy,c.x*sin(th*c.y+c.z),lx*sy+lz*cy);
}
struct FO{w:vec3f,n:vec3f};
fn fpos(p:vec3f,n:vec3f,u:vec4f,a:vec4f,b:vec4f,c:vec4f,d:vec4f)->FO{
  let t=g.cam.w;
  let th=c.w+d.x*t;
  let P=pth(a,b,c,th);
  let f=normalize(pth(a,b,c,th+.02*sign(d.x))-P);
  let r=normalize(cross(f,vec3f(0.,1.,0.)));
  let up=cross(r,f);
  let sc=d.y;
  let md=floor(d.w);let ph=fract(d.w)*6.2832;
  let fq=qa(7./pow(sc,.6));
  var q=p;var m=n;
  let fl=u.w;
  if(md<.5){
    let ar=q.x*5.+t*fq+ph;let am=.085*(.1+fl*fl);
    q.z+=am*sin(ar);m.x-=am*5.*cos(ar)*m.z;
  }else if(md<1.5){
    let ar=q.x*4.+t*fq+ph;let am=(.06+.07*step(sc,5.))*(.12+fl*fl);
    q.y+=am*sin(ar);m.x-=am*4.*cos(ar)*m.y;
  }else if(md<2.5){
    let fm=max(fl,0.);let fa=.02+.085*sin(t*fq-fm*1.4+ph);q.y+=fm*fa;
    if(floor(d.z)==21.){m.z-=fa*3.2*q.z*m.y;}
  }else{
    let s=sin(t*qa(2.2)+ph);let fc=min(fl,1.);
    q=vec3f(q.x+.07*s*fc,q.yz*(1.-.22*fc*s));
    let tw=max(fl-1.,0.);
    q.y+=.1*tw*sin(t*qa(1.7)+q.x*5.+ph);q.z+=.1*tw*cos(t*qa(1.3)+q.x*4.+ph);
  }
  var o:FO;
  o.w=P+(f*q.x+up*q.y+r*q.z)*sc;
  o.n=normalize(f*m.x+up*m.y+r*m.z);
  return o;
}
@vertex fn vf(@location(0)p:vec3f,@location(1)n:vec3f,@location(2)u:vec4f,@location(4)a:vec4f,@location(5)b:vec4f,@location(6)c:vec4f,@location(7)d:vec4f)->FV{
  let o=fpos(p,n,u,a,b,c,d);
  return FV(g.vp*vec4f(o.w,1.),o.w,o.n,u,vec2f(floor(d.z),fract(d.z)));
}
@vertex fn vfS(@location(0)p:vec3f,@location(1)n:vec3f,@location(2)u:vec4f,@location(4)a:vec4f,@location(5)b:vec4f,@location(6)c:vec4f,@location(7)d:vec4f)->@builtin(position)vec4f{
  if(d.y>1.5){return vec4f(2.,2.,2.,1.);}
  return g.svp*vec4f(fpos(p,n,u,a,b,c,d).w,1.);
}
fn bx(a:f32,b:f32,x:f32)->f32{return smoothstep(a-.012,a+.012,x)*(1.-smoothstep(b-.012,b+.012,x));}
fn fcol(id:f32,uv:vec4f,vr:f32,nz:vec4f)->vec4f{
  let u=uv.x;let v=uv.y;let pt=uv.z;let fl=uv.w;
  let fin=f32(pt>.5&&pt<1.5);
  let bk=clamp(v*.5+.5,0.,1.);
  let cs=smoothstep(-.7,.3,v);
  var c=vec3f(.6);var sp=.5;
  if(id<.5){c=mix(vec3f(.3,.95,.8),vec3f(.04,.4,.95),bk)*(1.-.35*fin);}
  else if(id<1.5){c=mix(vec3f(1.,.55,.1),vec3f(1.,.2,.36),bk);c=mix(c,vec3f(.8,.25,.9),fin*.7);}
  else if(id<2.5){c=vec3f(1.,.3,.02);let b=min(min(abs(u-.74),abs(u-.44)),abs(u-.1));
    c=mix(vec3f(.02),c,smoothstep(.055,.07,b));c=mix(vec3f(.85),c,smoothstep(.035,.045,b));
    c=mix(c,vec3f(.02),fin*smoothstep(1.35,1.5,abs(v)));}
  else if(id<3.5){c=vec3f(.03,.15,.9);
    let m=(1.-smoothstep(.1,.18,abs(v-.3-.3*sin(u*3.5+.4))))*smoothstep(.12,.2,u)*(1.-smoothstep(.72,.8,u));
    c=mix(c,vec3f(.01,.01,.05),m);c=mix(c,vec3f(1.,.85,.05),1.-step(.03,u));}
  else if(id<4.5){c=mix(vec3f(.85),vec3f(1.,.78,.04),smoothstep(-.5,.5,v+.6-u));
    c=mix(vec3f(.02),c,smoothstep(.025,.04,abs(u-.86)));
    c=mix(vec3f(.02),c,smoothstep(.05,.07,length(vec2f(u-.2,(v-.55)*.3))));}
  else if(id<5.5){let s=u+v*.07;c=mix(vec3f(.8),vec3f(.02),max(bx(.5,.68,s),bx(.18,.34,s)));
    c=mix(c,vec3f(1.,.8,.05),1.-smoothstep(.08,.15,u));c=mix(c,vec3f(.8),fin*step(1.3,v));}
  else if(id<6.5){let s=sin(u*70.)*sin(v*9.+u*8.);c=mix(vec3f(.05,.78,.7),vec3f(.1,.5,.92),bk);
    c=mix(c,vec3f(1.,.42,.6),smoothstep(.3,.8,s)*.7);c=mix(c,vec3f(.3,.95,.5),smoothstep(.72,.8,u)*.5);
    c=mix(c,vec3f(.2,.35,1.),fin*.7);}
  else if(id<7.5){c=vec3f(1.,.8,.03);}
  else if(id<8.5){c=mix(vec3f(.9,.93,.95),vec3f(.95,.85,.2),smoothstep(.1,.7,v));
    c=mix(c,vec3f(.03),smoothstep(.5,.8,sin(u*31.+1.))*bx(.12,.8,u));}
  else if(id<9.5){c=mix(vec3f(.85,.9,.95),vec3f(.08,.42,.95),smoothstep(-.3,.2,v));
    c=mix(c,vec3f(1.,.85,.1),1.-smoothstep(.1,.22,abs(v-.45)));c=mix(c,vec3f(1.,.85,.1),1.-step(.04,u));}
  else if(id<10.5){c=mix(vec3f(.85,.9,.92),vec3f(.2,.3,.38),smoothstep(.2,.8,v));sp=1.3;}
  else if(id<11.5){c=mix(vec3f(.06,.18,.85),vec3f(1.,.8,.1),smoothstep(-.25,.25,sin(v*16.+u*5.)));
    c=mix(c,vec3f(.03,.05,.25),smoothstep(.78,.84,u));c=mix(c,vec3f(1.,.6,.05),1.-step(.03,u));}
  else if(id<20.5){c=mix(vec3f(.85),vec3f(.27,.32,.39),max(smoothstep(-.3,.05,v+.15*sin(u*7.)),fin));c*=1.-.35*bx(.7,.77,u)*step(.6,fract(u*55.))*bx(-.35,.25,v)*(1.-fin);c=mix(c,vec3f(.05),bx(.93,.99,u)*bx(-.75,-.45,v));c=mix(c,vec3f(.03),fin*smoothstep(1.5,1.75,abs(v)));sp=.3;}
  else if(id<21.5){let top=step(0.,v);
    c=mix(mix(vec3f(1.7,1.72,1.75),vec3f(.3,.34,.4),max(max(smoothstep(.3,1.,fl+.3*u-.1),smoothstep(.86,.97,u)*.75),max(bx(.1,.2,u)*bx(.012,.075,fl)*step(.5,fract(fl*70.))*.8,(1.-smoothstep(.02,.05,u))*(1.-smoothstep(.01,.03,fl))))),mix(vec3f(.08,.1,.14),vec3f(.4),max(bx(.1,.3,u)*bx(.05,.28,fl)*.6,smoothstep(.85,1.,fl)*.3)),top);c=mix(c,vec3f(.03),step(2.5,pt));sp=.25;}
  else if(id<22.5){
    let p=vec2f(u*4.,v*2.3);let px=p.x+.5*floor(p.y+.5);
    let e=max(abs(fract(px)-.5),abs(fract(p.y+.5)-.5));
    let sh=mix(vec3f(.62,.4,.14)*(.55+.9*smoothstep(.2,.8,nz.g))*(1.-1.2*e),vec3f(.07,.05,.03),smoothstep(.41,.47,e));
    let sk=mix(vec3f(.62,.62,.42),vec3f(.3,.36,.22),smoothstep(.25,.7,nz.g));
    c=mix(sh,sk,step(2.5,pt));c=mix(c,mix(vec3f(1.25,1.15,.78),vec3f(.85,.76,.5),smoothstep(.43,.49,e))*(.85+.3*nz.g),1.-smoothstep(-.8,-.2,fl));sp=.4;}
  else if(id<23.5){c=mix(vec3f(.72,.75,.8),vec3f(.03,.05,.09),smoothstep(-.8,.1,v+.15*sin(u*9.)+.3*(u-.6)));
    c*=1.-.22*smoothstep(.42,.6,u)*(1.-smoothstep(.9,.97,u))*(1.-smoothstep(-.5,-.15,v))*smoothstep(.35,.5,abs(fract(v*12.)-.5)*2.);c=mix(c,mix(vec3f(.05,.08,.13),vec3f(.04,.07,.12),smoothstep(-.2,.2,uv.w-2.5+step(0.,v)*9.)),fin);c=mix(c,vec3f(.02,.03,.05),(1.-smoothstep(.03,.09,abs(v+.42-.5*(u-.72))))*smoothstep(.7,.78,u)*(1.-fin)*.85);sp=.2;}
  else if(id<24.5){c=mix(vec3f(.72,.75,.8),vec3f(.1,.14,.22),max(smoothstep(-.35,0.,v-.25*sin(u*5.+1.)),fin));c=mix(c,vec3f(.5,.56,.64),bx(.3,.7,u)*bx(-.2,.25,v)*.5*(1.-fin));sp=.7;}
  else{c=mix(vec3f(.85),vec3f(.1,.18,.3),max(cs,fin));
    c=mix(c,vec3f(.85,.92,1.),smoothstep(.6,.85,sin(u*130.+v*3.)*sin(v*17.+u*40.))*max(cs,fin)*.85);sp=.2;}
  if(pt>1.5&&pt<2.5){c=mix(vec3f(.01),vec3f(.9,.85,.6),smoothstep(.55,.65,v)*step(id,19.5));sp=2.;}
  c*=.85+.3*vr;
  return vec4f(c,sp*(1.-.85*fin));
}
@fragment fn ff(i:FV)->@location(0)vec4f{
  let nz=textureSample(nzT,smp,i.u.xy*vec2f(5.,2.5)+i.u.ww*vec2f(1.7,2.3));
  let cs=fcol(i.k.x,i.u,i.k.y,nz);
  let V=normalize(g.cam.xyz-i.w);var n=normalize(i.n);
  if(dot(n,V)<0.){n=-n;}
  let fin=f32(i.u.z>.5&&i.u.z<1.5);
  n=normalize(n+fin*(vec3f(0.,.9,0.)+V*.5));
  return vec4f(fogk(lit(cs.rgb,n,i.w,1.,cs.a),i.w,select(1.,.4,i.k.x>19.5)),1.);
}
@fragment fn fj(i:FV)->@location(0)vec4f{
  let V=normalize(g.cam.xyz-i.w);
  let f=1.-abs(dot(normalize(i.n),V));
  let bell=1.-step(.5,i.u.z);
  var c=mix(vec3f(1.,.5,.85),vec3f(.55,.8,1.),i.k.y);
  let st=.75+.25*sin(i.u.x*50.);
  let al=mix(.35,.12+.8*f*f,bell)*mix(1.,st,bell);
  c*=(.8+1.4*f*bell)*vec3f(.9,1.1,1.2);
  return vec4f(fog(c,i.w),al);
}
// ---------- particles
struct PV{@builtin(position)p:vec4f,@location(0)q:vec2f,@location(1)c:vec4f};
fn h3(n:f32)->vec3f{return fract(sin(vec3f(n*12.9898,n*78.233,n*37.719))*43758.5453);}
@vertex fn vp(@builtin(vertex_index)vi:u32,@builtin(instance_index)ii:u32)->PV{
  let q=vec2f(f32(vi&1u),f32(vi>>1u))*2.-1.;
  let n=f32(ii);let h=h3(n+1.);let h2=h3(n+.5);
  let t=g.cam.w;
  var p:vec3f;var sz:f32;var bub=0.;var br=1.;
  if(ii<${NB}u){
    let sh=h3(floor(n/20.)+100.);
    let k=fract(h.x+t*ql(.06+.03*h.y));
    let w=.05*(1.+k*4.);
    p=vec3f((sh.x-.5)*16.,.3,-1.-sh.y*15.)+vec3f(sin(k*31.+h.z*6.)*w+(h2.x-.5)*.5*k,k*(SURF-.3),cos(k*23.+h.y*6.)*w+(h2.z-.5)*.5*k);
    sz=(.01+.018*h2.y)*(.6+k);bub=1.;br=.7;
  }else{
    p=vec3f(-17.,-.5,-28.)+fract(h+t*round(vec3f(9.,6.6,4.9)*(h2*2.-1.))/4096.)*vec3f(34.,11.,37.);
    p.x+=sin(t*qa(.9)+p.x*.35+p.z*.27)*.07;
    sz=.004+.009*h2.y;br=.15+.35*h2.x;
  }
  let cp=g.vp*vec4f(p,1.);
  let d=max(cp.w,.05);
  let pr=sz*g.res.y/(g.res.z*d)*.5;
  let px=max(pr,1.1+bub);
  let r=px*2./g.res.y;
  let a=exp(-d*.075)*smoothstep(.4,1.6,d)*min(1.,pr*pr/(px*px)+.12)*br;
  var o:PV;
  o.p=vec4f(cp.xy+q*vec2f(r/g.res.w,r)*cp.w,cp.zw);
  o.q=q;o.c=vec4f(mix(vec3f(.65,.9,1.),vec3f(.8,1.,1.),bub)*a,bub);
  return o;
}
@fragment fn fp(i:PV)->@location(0)vec4f{
  let r=length(i.q);
  let dot_=1.-smoothstep(.15,1.,r);
  let ring=(1.-smoothstep(.85,1.,r))*(.25+smoothstep(.45,.9,r))+2.*(1.-smoothstep(0.,.3,length(i.q-vec2f(-.35,.4))));
  return vec4f(i.c.rgb*mix(dot_,ring,i.c.a),1.);
}
`;

export const CAUS = /*wgsl*/`
struct G{vp:mat4x4f,svp:mat4x4f,cam:vec4f,sun:vec4f,res:vec4f,cr:vec4f,cu:vec4f,cf:vec4f};
@group(0)@binding(0)var<uniform>g:G;
fn qa(w:f32)->f32{return round(w*651.8986)/651.8986;}
@vertex fn v(@builtin(vertex_index)i:u32)->@builtin(position)vec4f{
  return vec4f(vec2f(f32((i<<1u)&2u),f32(i&2u))*2.-1.,0.,1.);
}
fn wv(uv:vec2f,k:vec2f,a:f32,w:f32,p:f32)->vec3f{
  let s=a*sin(6.2832*dot(k,uv)+g.cam.w*qa(w)+p)/dot(k,k);
  return -s*vec3f(k.x*k.x,k.y*k.y,k.x*k.y);
}
@fragment fn f(@builtin(position)p:vec4f)->@location(0)vec4f{
  let uv=p.xy/256.;
  var h=wv(uv,vec2f(1.,2.),.5,.9,0.)+wv(uv,vec2f(-2.,1.),.5,-1.1,1.3)+wv(uv,vec2f(3.,1.),.45,1.4,2.1)+wv(uv,vec2f(-1.,3.),.45,-1.3,4.2)
   +wv(uv,vec2f(2.,-3.),.42,1.6,5.1)+wv(uv,vec2f(4.,1.),.4,-1.8,.7)+wv(uv,vec2f(-3.,-3.),.4,1.7,3.3)+wv(uv,vec2f(1.,-4.),.38,-1.9,2.9)
   +wv(uv,vec2f(5.,2.),.36,2.2,1.9)+wv(uv,vec2f(-2.,5.),.36,-2.1,.2)+wv(uv,vec2f(6.,-1.),.3,2.5,4.9)+wv(uv,vec2f(-4.,-5.),.3,-2.4,3.9);
  let det=(1.+h.x)*(1.+h.y)-h.z*h.z;
  let c=.3/(abs(det)+.12);
  return vec4f(min(c*c*1.6+.25,6.),0.,0.,1.);
}
`;

export const POST = /*wgsl*/`
@group(0)@binding(0)var s:sampler;
@group(0)@binding(1)var a:texture_2d<f32>;
@group(0)@binding(2)var b:texture_2d<f32>;
struct V{@builtin(position)p:vec4f,@location(0)uv:vec2f};
@vertex fn v(@builtin(vertex_index)i:u32)->V{
  let q=vec2f(f32((i<<1u)&2u),f32(i&2u));
  return V(vec4f(q*2.-1.,0.,1.),vec2f(q.x,1.-q.y));
}
fn bxf(uv:vec2f,k:f32)->vec3f{
  let e=k/vec2f(textureDimensions(a));
  return (textureSampleLevel(a,s,uv+e*vec2f(-1.,-1.),0.).rgb+textureSampleLevel(a,s,uv+e*vec2f(1.,-1.),0.).rgb+textureSampleLevel(a,s,uv+e*vec2f(-1.,1.),0.).rgb+textureSampleLevel(a,s,uv+e,0.).rgb)*.25;
}
@fragment fn d0(i:V)->@location(0)vec4f{
  let c=min(bxf(i.uv,1.),vec3f(12.));
  let l=max(c.r,max(c.g,c.b));
  return vec4f(c*(smoothstep(.9,2.8,l)+.05),1.);
}
@fragment fn dn(i:V)->@location(0)vec4f{return vec4f(bxf(i.uv,1.),1.);}
@fragment fn up(i:V)->@location(0)vec4f{return vec4f(bxf(i.uv,.5)*.8,1.);}
@fragment fn cm(i:V)->@location(0)vec4f{
  var c=textureSampleLevel(a,s,i.uv,0.).rgb+textureSampleLevel(b,s,i.uv,0.).rgb*.55;
  let q=i.uv-.5;
  c*=1.-.42*smoothstep(.25,.95,length(q)*1.25);
  c*=1.05;
  c=clamp(c*(2.51*c+.03)/(c*(2.43*c+.59)+.14),vec3f(0.),vec3f(1.));
  let l=dot(c,vec3f(.2126,.7152,.0722));
  c=mix(vec3f(l),c,1.12);
  c=pow(max(c,vec3f(0.)),vec3f(1./2.2));
  let n=fract(sin(dot(i.p.xy,vec2f(12.9898,78.233)))*43758.5453);
  return vec4f(c+(n-.5)/255.,1.);
}
`;
