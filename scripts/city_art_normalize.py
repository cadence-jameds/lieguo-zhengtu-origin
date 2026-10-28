"""Uniform city placement calibration against the same civilization's castle cell.
No anisotropic stretching, repainting, or gameplay footprint changes.
"""
from PIL import Image

def silhouette_bounds(image):
    return image.getchannel('A').point(lambda a:255 if a>96 else 0).getbbox()

def calibrate_city(image, castle, index):
    reference=castle.crop((index%3*512,index//3*512,index%3*512+512,index//3*512+512)).convert('RGBA')
    old=silhouette_bounds(reference);new=silhouette_bounds(image)
    # Keep architectural advancement, but cap whole-city height at +6%.
    # Never enlarge: legacy atlas gutters already leave very little free space.
    scale=min(1.,1.06*(old[3]-old[1])/(new[3]-new[1]))
    dx=(old[0]+old[2])/2-scale*(new[0]+new[2])/2
    dy=old[3]-scale*new[3]
    result=image.transform((512,512),Image.Transform.AFFINE,(1/scale,0,-dx/scale,0,1/scale,-dy/scale),Image.Resampling.BICUBIC)
    return result,{'reference':'public/art/cities-age-2.webp','referenceIndex':index,'referenceBounds':list(old),'inputBounds':list(new),'scale':scale,'translation':[dx,dy],'heightCapRatio':1.06,'method':'one uniform affine transform; same-civilization castle foot and horizontal center; no upscaling'}
