import { useEffect, useRef } from 'react';
import type { Settings } from './model';
import { simulatedSpread } from './preview-motion';

export function Preview({settings:s,zoom=1,dynamic=false,scope=false,sniper=false}: {settings:Settings;zoom?:number;dynamic?:boolean;scope?:boolean;sniper?:boolean}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current!;let frame=0;const context=canvas.getContext('2d')!;
    function draw(time:number){
      const dpr=window.devicePixelRatio||1;
      const width=canvas.clientWidth,height=canvas.clientHeight;
      const pixelsWide=Math.round(width*dpr),pixelsHigh=Math.round(height*dpr);
      if(canvas.width!==pixelsWide||canvas.height!==pixelsHigh){canvas.width=pixelsWide;canvas.height=pixelsHigh;}
      context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);
      context.scale(dpr,dpr);context.translate(Math.floor(width/2),Math.floor(height/2));context.scale(zoom,zoom);
      const color=`rgba(${s.cl_crosshaircolor_r},${s.cl_crosshaircolor_g},${s.cl_crosshaircolor_b},${s.cl_crosshaircolor_a/255})`;
      const outline=`rgba(${s.cl_crosshairoutline_r},${s.cl_crosshairoutline_g},${s.cl_crosshairoutline_b},${s.cl_crosshairoutline_a/255})`;
      const mode=s.cl_crosshair_drawoutline,style=s.cl_crosshairstyle;
      const wave=dynamic?(1-Math.cos(time/550))/2:0;
      const spread=simulatedSpread(style,s.cl_crosshair_dynamic_spread_limit,wave);
      if(dynamic&&s.cl_crosshair_recoil) context.translate(Math.round(Math.sin(time/250)*wave*3),-Math.round(wave*7));
      const thickness=s.cl_crosshair_thickness,half=thickness/2,gap=Math.round(s.cl_crosshair_gap/2)+spread,length=s.cl_crosshair_length;
      function rectangle(x:number,y:number,w:number,h:number,alpha=1){
        if(w<=0||h<=0)return;context.globalAlpha=alpha;
        if(mode){context.fillStyle=outline;context.fillRect(x-1,y-1,w+(mode===1?2:1),h+(mode===1?2:1));}
        context.fillStyle=color;context.fillRect(x,y,w,h);context.globalAlpha=1;
      }
      function circle(radius:number,start=0,end=Math.PI*2){
        if(thickness<=0)return;
        if(mode){context.strokeStyle=outline;context.lineWidth=thickness+(mode===1?2:1);context.beginPath();context.arc(mode===2?-.5:0,mode===2?-.5:0,Math.max(.5,radius),start,end);context.stroke();}
        context.strokeStyle=color;context.lineWidth=thickness;context.beginPath();context.arc(0,0,Math.max(.5,radius),start,end);context.stroke();
      }
      if(sniper){
        context.fillStyle='rgba(0,0,0,.9)';context.fillRect(-width/zoom/2,-s.cl_crosshair_sniper_width/2,width/zoom,s.cl_crosshair_sniper_width);
        context.fillRect(-s.cl_crosshair_sniper_width/2,-height/zoom/2,s.cl_crosshair_sniper_width,height/zoom);
        if(dynamic&&s.cl_sniper_show_inaccuracy){context.fillStyle='rgba(0,0,0,.12)';context.beginPath();context.arc(0,0,12*wave,0,Math.PI*2);context.fill();}
      }else if(scope){
        const dot=Math.max(1,s.cl_ironsight_dot_scale*3);context.fillStyle=s.cl_ironsight_usecrosshaircolor?color:'#e22924';context.beginPath();context.arc(0,0,dot/2,0,Math.PI*2);context.fill();
      }else{
        if([0,2,4,5,7].includes(style)){
          const classicSplit=style===2&&spread>s.cl_crosshair_dynamic_splitdist;
          const inner=classicSplit?Math.round(length*(1-s.cl_crosshair_dynamic_maxdist_splitratio)):length;
          const arms=[[-gap-inner,-half,inner,thickness],[gap,-half,inner,thickness],[-half,gap,thickness,inner],...s.cl_crosshair_t?[]:[[-half,-gap-inner,thickness,inner]]];
          arms.forEach(([x,y,w,h])=>rectangle(x,y,w,h,classicSplit?s.cl_crosshair_dynamic_splitalpha_innermod:1));
          if(classicSplit){const outer=length-inner,dist=gap+inner+s.cl_crosshair_dynamic_splitdist;
            [[-dist-outer,-half,outer,thickness],[dist,-half,outer,thickness],[-half,dist,thickness,outer],...s.cl_crosshair_t?[]:[[-half,-dist-outer,thickness,outer]]].forEach(([x,y,w,h])=>rectangle(x,y,w,h,s.cl_crosshair_dynamic_splitalpha_outermod));}
        }
        if([1,3].includes(style))circle(Math.max(1,(style===1?4:gap)+thickness/2+spread));
        if(style===8){const r=Math.max(0,gap);rectangle(-r-thickness,-r-thickness,r*2+thickness*2,thickness);rectangle(-r-thickness,r,r*2+thickness*2,thickness);rectangle(-r-thickness,-r,thickness,r*2);rectangle(r,-r,thickness,r*2);}
        if([7,9].includes(style)){
          const radius=Math.max(2,gap+thickness+2);const ratio=style===9?s.cl_crosshair_dynamic_maxdist_splitratio:.65;
          for(let i=0;i<4;i++){const mid=Math.PI/4+i*Math.PI/2;circle(radius,mid-Math.PI/4*ratio,mid+Math.PI/4*ratio);}
        }
        if(s.cl_crosshairdot||style===6)rectangle(-half,-half,thickness,thickness);
      }
      if(dynamic)frame=requestAnimationFrame(draw);
    }
    const observer=new ResizeObserver(()=>{if(!dynamic)draw(0);});observer.observe(canvas);
    frame=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(frame);observer.disconnect();};
  },[s,zoom,dynamic,scope,sniper]);
  return <canvas ref={ref} role="img" aria-label={sniper?'Sniper sight preview':scope?'Scope dot preview':'Live crosshair preview'} className="crosshair-canvas"/>;
}
