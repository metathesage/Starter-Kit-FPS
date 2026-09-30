"""UDIM (1001..10xx along U) character -> single atlas material, then same normalisation as prep_char.
usage: python3 prep_udim.py -- in.fbx out.glb tex_dir_prefix(e.g. /tmp/drv/lucy/) [tris=30000] [tile=768]"""
import bpy, sys, math, os
from mathutils import Vector, Matrix
from PIL import Image
a = sys.argv[sys.argv.index('--') + 1:]
src, dst, texdir = a[0], a[1], a[2]; tris = int(a[3]) if len(a) > 3 else 30000; TILE = int(a[4]) if len(a) > 4 else 768
COLS, ROWS, N = 5, 2, 10
atlas = Image.new('RGB', (COLS * TILE, ROWS * TILE), (30, 30, 34))
for i in range(N):
    f = f'{texdir}{1001 + i}.jpg'
    if not os.path.exists(f): continue
    im = Image.open(f).convert('RGB').resize((TILE, TILE), Image.LANCZOS); col, row = i % COLS, i // COLS
    atlas.paste(im, (col * TILE, (ROWS - 1 - row) * TILE))
apath = texdir + 'atlas.png'; atlas.save(apath)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)
sc = bpy.context.scene
ms = [o for o in sc.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in ms: o.select_set(True)
bpy.context.view_layer.objects.active = ms[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in sc.objects if o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
# remap UDIM uvs per object before joining
for o in [o for o in sc.objects if o.type == 'MESH']:
    uvl = o.data.uv_layers.active
    if not uvl: continue
    for l in uvl.data:
        u, v = l.uv[0], l.uv[1]
        t = max(0, min(N - 1, int(math.floor(u - 1e-5)) if u > 0 else 0)); col, row = t % COLS, t // COLS
        fu = min(1.0, max(0.0, u - t)); fv = min(1.0, max(0.0, v))
        l.uv = ((col + fu) / COLS, (row + fv) / ROWS)
    o.data.materials.clear()
mat = bpy.data.materials.new('lucy'); mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']; tx = mat.node_tree.nodes.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(apath)
mat.node_tree.links.new(tx.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = 0.6
for o in sc.objects:
    if o.type == 'MESH': o.data.materials.append(mat)
bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = [o for o in sc.objects if o.type == 'MESH'][0]
bpy.ops.object.join(); o = bpy.context.object
import bmesh
bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bm.to_mesh(o.data); bm.free()   # mirrored FBX transforms flip winding: make faces point outward
n = sum(len(p.vertices) - 2 for p in o.data.polygons)
if n > tris:
    md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = tris / n; md.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
co = [v.co.copy() for v in o.data.vertices]
mn = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co))); mx = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
H = mx.z - mn.z; k = 1.0 / H
o.data.transform(Matrix.Translation(Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z)))); o.data.transform(Matrix.Scale(k, 4)); o.data.transform(Matrix.Translation(Vector((0, 0, -0.5))))
print('tris', n, '->', sum(len(p.vertices) - 2 for p in o.data.polygons), 'H', round(H, 3))
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=90, export_apply=True, export_yup=True, export_animations=False)
