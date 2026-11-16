# Cuts Dennis's generated character art (magenta background) down to sprite size.
import sys, json
from PIL import Image
import numpy as np
# Usage: python3 tools/import_hero_art.py <folder with c404.png grib.png hexa.png brugg.png>
# Writes sprites.json and prev_*.png; then tools/hero_art_to_ts.py writes src/render/heroArt.ts.
U=sys.argv[1].rstrip('/')+'/'
SRC={k: k+'.png' for k in ['c404','grib','hexa','brugg']}
BOX={'c404':(48,61),'grib':(48,52),'hexa':(48,63),'brugg':(64,79)}
OUT={}
for k,f in SRC.items():
    a=np.asarray(Image.open(U+f).convert('RGB')).astype(int)
    r,g,b=a[...,0],a[...,1],a[...,2]
    bg=(r>150)&(b>150)&(g<120)&(abs(r-b)<70)
    fringe=(g<60)&(abs(r-b)<50)&(r>90)
    for _ in range(8):
        n=bg.copy(); n[1:,:]|=bg[:-1,:]; n[:-1,:]|=bg[1:,:]; n[:,1:]|=bg[:,:-1]; n[:,:-1]|=bg[:,1:]
        bg=bg|(n&fringe)
    fg=~bg
    e=fg.copy(); e[1:,:]&=fg[:-1,:]; e[:-1,:]&=fg[1:,:]; e[:,1:]&=fg[:,:-1]; e[:,:-1]&=fg[:,1:]; fg=e
    ys,xs=np.where(fg)
    y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
    crop=a[y0:y1,x0:x1]; m=fg[y0:y1,x0:x1].astype(float)
    W,H=BOX[k]; s=min(W/(x1-x0),H/(y1-y0)); tw,th=max(1,round((x1-x0)*s)),max(1,round((y1-y0)*s))
    rgba=np.dstack([crop*m[...,None],m*255]).astype(np.uint8)
    im=Image.fromarray(rgba,'RGBA')
    # premultiplied resize
    small=im.resize((tw,th),Image.BOX)
    arr=np.asarray(small).astype(float)
    al=arr[...,3]/255
    col=np.where(al[...,None]>0, arr[...,:3]/np.maximum(al[...,None],1e-6),0).clip(0,255)
    keep=al>0.5
    q=Image.fromarray(col.astype(np.uint8),'RGB').quantize(colors=32,method=Image.MEDIANCUT)
    pal=q.getpalette()[:96]; idx=np.asarray(q)
    OUT[k]=dict(w=tw,h=th,keep=keep.tolist(),idx=idx.tolist(),pal=['#%02x%02x%02x'%tuple(pal[i*3:i*3+3]) for i in range(32)])
    # preview
    prev=np.zeros((th,tw,4),np.uint8)
    for y in range(th):
        for x in range(tw):
            if keep[y,x]:
                c=pal[idx[y,x]*3:idx[y,x]*3+3]; prev[y,x]=[*c,255]
    Image.fromarray(prev,'RGBA').resize((tw*6,th*6),Image.NEAREST).save(f'prev_{k}.png')
    print(k,tw,th)
json.dump(OUT,open('sprites.json','w'))
