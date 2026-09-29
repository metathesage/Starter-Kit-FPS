#!/usr/bin/env python3
"""Shrink a GLB's embedded textures (PNG -> JPEG, max side N). usage: optimize_glb.py in.glb out.glb [max=768] [quality=86]"""
import io, json, struct, sys
from PIL import Image

def read(path):
    d = open(path, 'rb').read()
    ln = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + ln]); off = 20 + ln
    blen = struct.unpack('<I', d[off:off + 4])[0]
    return j, d[off + 8:off + 8 + blen]

def main(src, dst, mx=768, q=86):
    j, b = read(src)
    views = j['bufferViews']; data = {i: b[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for i, v in enumerate(views)}
    for im in j.get('images', []):
        i = im['bufferView']; img = Image.open(io.BytesIO(data[i]))
        if img.width > mx or img.height > mx: img.thumbnail((mx, mx), Image.LANCZOS)
        out = io.BytesIO(); img.convert('RGB').save(out, 'JPEG', quality=q, optimize=True)
        data[i] = out.getvalue(); im['mimeType'] = 'image/jpeg'
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
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 768, int(sys.argv[4]) if len(sys.argv) > 4 else 86)
