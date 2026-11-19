import sys, numpy as np
from PIL import Image
from scipy import ndimage
src,dst,y0,y1=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4])
im=np.asarray(Image.open(src)).astype(float)
r,g,b,a=[im[...,i] for i in range(4)]
H,W=r.shape; yy,xx=np.mgrid[0:H,0:W]
band=(yy>=y0)&(yy<=y1)&(a>128)
lum=0.3*r+0.59*g+0.11*b
pink=band&(r-g>22)&(b-g>-4)&(r>70)
pink=ndimage.binary_opening(pink,iterations=1)
lab,k=ndimage.label(pink); sizes=ndimage.sum(pink,lab,range(1,k+1))
pink=np.isin(lab,1+np.where(sizes>600)[0])
core=ndimage.binary_fill_holes(ndimage.binary_closing(pink,iterations=8))
mask=core.copy()
for _ in range(10):  # grow into dark trim / mesh only
    mxx=np.maximum(np.maximum(r,g),b); mnn=np.minimum(np.minimum(r,g),b)
    grow=ndimage.binary_dilation(mask)&band&(((lum<75)&(mxx-mnn<45))|((r-g>15)&(b-g>-6)))
    mask|=grow
mask=ndimage.binary_closing(ndimage.binary_dilation(mask,iterations=1),iterations=4)&band
mx=np.maximum(np.maximum(r,g),b); mn=np.minimum(np.minimum(r,g),b)
ring=ndimage.binary_dilation(mask,iterations=40)&~ndimage.binary_dilation(mask,iterations=6)&band
cand=ring&(mx-mn<35)&(lum>110)
cols=np.where(mask.any(0))[0]; cx=(cols.min()+cols.max())/2
rows=np.arange(H)
def side(sel):
    out=np.full((H,3),np.nan)
    for y in rows:
        m=sel[max(0,y-20):y+21]
        if m.sum()>20:
            for c,ch in enumerate((r,g,b)): out[y,c]=np.median(ch[max(0,y-20):y+21][m])
    for c in range(3):
        v=out[:,c]; ok=~np.isnan(v)
        out[:,c]=np.interp(rows,rows[ok],v[ok]) if ok.any() else np.nan
    return ndimage.gaussian_filter1d(out,15,axis=0)
Lc=side(cand&(xx<cx)); Rc=side(cand&(xx>=cx))
if np.isnan(Lc).any(): Lc=Rc
if np.isnan(Rc).any(): Rc=Lc
mins=np.array([xx[y][mask[y]].min() if mask[y].any() else 0 for y in rows])
maxs=np.array([xx[y][mask[y]].max() if mask[y].any() else 1 for y in rows])
t=np.clip((xx-mins[:,None])/np.maximum(maxs-mins,1)[:,None],0,1)
base=Lc[:,None,:]*(1-t[...,None])+Rc[:,None,:]*t[...,None]
L=np.where(mask,lum,np.nan); fillv=np.nanmedian(L)
lc=np.where(mask&(lum<fillv*0.85),fillv,lum)
sh=ndimage.gaussian_filter(np.where(mask,lc,fillv),10)
shade=np.clip(sh/fillv,0.9,1.06)
rng=np.random.default_rng(1); grain=ndimage.gaussian_filter(rng.normal(0,1,(H,W)),0.8)*3
soft=np.clip(ndimage.gaussian_filter(mask.astype(float),3.0)*1.25,0,1)
out=im.copy()
cut=int(sys.argv[5]) if len(sys.argv)>5 else 10**9
kill=mask&(yy>cut)
out[...,3]=np.where(ndimage.binary_dilation(kill,iterations=2),0,out[...,3])
for c in range(3):
    out[...,c]=im[...,c]*(1-soft)+np.clip(base[...,c]*shade+grain,0,255)*soft
Image.fromarray(out.astype(np.uint8)).save(dst)
print('mask',mask.sum())
