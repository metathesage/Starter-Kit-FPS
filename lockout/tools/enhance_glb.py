#!/usr/bin/env python3
"""Make an AI-generated (baked-lighting) GLB behave better under real-time lighting.
- removes the low-frequency baked shading from the base colour texture (flattens large-scale light/dark, keeps detail)
- gentle contrast + unsharp for crisp panel lines
- estimates a metallic/roughness map from colour (dark neutral = gunmetal, saturated/bright = painted/polymer)
usage: enhance_glb.py in.glb out.glb [tex=1024] [delight=0.75] [metal=0.85]"""
import io, json, struct, sys
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

def read(path):
    d = open(path, 'rb').read(); ln = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + ln]); off = 20 + ln; bl = struct.unpack('<I', d[off:off + 4])[0]
    return j, d[off + 8:off + 8 + bl]

def main(src, dst, tex=1024, delight=0.75, metal=0.85):
    j, b = read(src); views = j['bufferViews']
    data = {i: b[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for i, v in enumerate(views)}
    im = j['images'][0]; img = Image.open(io.BytesIO(data[im['bufferView']])).convert('RGB')
    if max(img.size) > tex: img = img.resize((tex, tex), Image.LANCZOS)
    a = np.asarray(img).astype(np.float32) / 255.0
    lum = a @ np.array([0.3, 0.55, 0.15], np.float32)
    blur = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(img.width / 26))).astype(np.float32) / 255.0
    ratio = np.clip((max(blur.mean(), 0.05) / np.maximum(blur, 0.04)) ** delight, 0.7, 1.9)
    a2 = np.clip(a * ratio[..., None], 0, 1)
    out = Image.fromarray((a2 * 255).astype(np.uint8))
    out = ImageEnhance.Contrast(out).enhance(1.12); out = ImageEnhance.Color(out).enhance(1.08)
    out = out.filter(ImageFilter.UnsharpMask(radius=1.6, percent=90, threshold=2))
    # metallic / roughness estimate (glTF: G = roughness, B = metallic)
    c = np.asarray(out).astype(np.float32) / 255.0
    mx, mn = c.max(-1), c.min(-1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-4), 0)
    dark_neutral = np.clip((0.42 - mx) / 0.3, 0, 1) * np.clip((0.35 - sat) / 0.25, 0, 1)
    light_metal = np.clip((mx - 0.55) / 0.3, 0, 1) * np.clip((0.12 - sat) / 0.12, 0, 1) * 0.6
    metal_map = np.clip(dark_neutral * metal + light_metal, 0, 1)
    rough = np.clip(0.78 - 0.42 * metal_map - 0.1 * (1 - sat), 0.28, 0.9)
    mr = np.stack([np.zeros_like(rough), rough, metal_map], -1)
    mr_img = Image.fromarray((mr * 255).astype(np.uint8)).resize((max(256, out.width // 2),) * 2, Image.LANCZOS)
    def enc(im, fmt, **kw):
        o = io.BytesIO(); im.save(o, fmt, **kw); return o.getvalue()
    data[im['bufferView']] = enc(out, 'JPEG', quality=92, optimize=True); im['mimeType'] = 'image/jpeg'
    nv = len(views); views.append({'buffer': 0, 'byteOffset': 0, 'byteLength': 1}); data[nv] = enc(mr_img, 'PNG', optimize=True)
    j['images'].append({'bufferView': nv, 'mimeType': 'image/png'})
    tex0 = j['textures'][0]; j['textures'].append({'source': len(j['images']) - 1, **({'sampler': tex0['sampler']} if 'sampler' in tex0 else {})})
    for m in j['materials']:
        p = m.setdefault('pbrMetallicRoughness', {}); p['metallicFactor'] = 1.0; p['roughnessFactor'] = 1.0
        p['metallicRoughnessTexture'] = {'index': len(j['textures']) - 1}
    nb = bytearray()
    for i, v in enumerate(views):
        while len(nb) % 4: nb.append(0)
        v['byteOffset'] = len(nb); v['byteLength'] = len(data[i]); nb += data[i]
    while len(nb) % 4: nb.append(0)
    j['buffers'] = [{'byteLength': len(nb)}]
    js = json.dumps(j, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    total = 12 + 8 + len(js) + 8 + len(nb)
    open(dst, 'wb').write(struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(nb), b'BIN\0') + bytes(nb))

if __name__ == '__main__':
    a = sys.argv
    main(a[1], a[2], int(a[3]) if len(a) > 3 else 1024, float(a[4]) if len(a) > 4 else 0.75, float(a[5]) if len(a) > 5 else 0.85)
