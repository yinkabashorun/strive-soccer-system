# Pre-composes the coach photos for the step slides and the close (run from this folder).
# Each call: source in photos/src, scale, the face centre in the source, where that face lands
# on the 1080x1350 canvas, the output. A photo that starts below the top edge is continued
# upward with its own top rows reflected, blurred and feathered so no hard line sits under
# the headline. Coach Yinka, Nov 4 2026: "Adjust the crop on these so we fit better instead
# of the space above our head."
from PIL import Image, ImageFilter, ImageEnhance
S="photos/src/"; F=220
def comp(src,k,head,target,out,canvas=(1080,1350),mirror=False,band_bright=.8):
    im=Image.open(S+src).convert("RGB")
    if mirror: im=im.transpose(Image.FLIP_LEFT_RIGHT)
    im=im.resize((round(im.width*k),round(im.height*k)),Image.LANCZOS)
    x=round(target[0]-head[0]*k); y=round(target[1]-head[1]*k)
    c=Image.new("RGB",canvas,(13,13,13))
    if y>0:
        # continue the photo upward: the top rows reflected, stretched, blurred and darkened,
        # feathered into the real edge so there is no hard line under the headline
        band=im.crop((0,0,im.width,120)).transpose(Image.FLIP_TOP_BOTTOM).resize((im.width,y+F),Image.LANCZOS)
        band=band.filter(ImageFilter.GaussianBlur(60)); band=ImageEnhance.Brightness(band).enhance(band_bright)
        c.paste(band,(x,0))
        mask=Image.linear_gradient("L").resize((im.width,F))  # 0 at top -> 255 at bottom
        top=im.crop((0,0,im.width,F)); c.paste(top,(x,y),mask)
        c.paste(im.crop((0,F,im.width,im.height)),(x,y+F))
    else:
        c.paste(im,(x,y))
    if out: c.save(out,quality=92)
    return c
comp("yinka-nva-strike.jpg",1.5,(590,300),(600,500),"photos/step1.jpg")
comp("gary-armenia-u19.jpg",1.3,(780,470),(700,490),"photos/step2.jpg")
comp("gary-armenia-u16.jpg",1.5,(575,160),(620,510),"photos/step3.jpg")
comp("gary-ecnl-captain.jpg",1.6,(340,95),(430,490),"photos/step4.jpg")
l=comp("yinka-college-lineup.jpg",0.9,(540,270),(270,510),None,(540,1350))
r=comp("gary-armenia-u19-lineup.jpg",0.72,(587,703),(270,510),None,(540,1350))  # Gary in the middle of the Armenia line, his pick Nov 4 (Koln photo kept in src)
c=Image.new("RGB",(1080,1350),(13,13,13)); c.paste(l,(0,0)); c.paste(r,(540,0)); c.save("photos/step5.jpg",quality=92)
comp("yinka-gainesville-celebration.jpg",1.9,(520,80),(560,250),"photos/close.jpg",band_bright=.3)  # close: the headline starts at mid chest (Coach Yinka, Nov 4)
