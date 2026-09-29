"""Hard-surface weapon kit for headless Blender (pip install bpy==4.2.0).
Conventions: build with the muzzle pointing +Y, up = +Z, grip near the origin. glTF export maps +Y to three.js -Z (the game's forward).
Materials are plain PBR factors (no textures): crisp edges, tiny files, they pick up the scene's environment light.
"""
import bpy, math, sys
from mathutils import Vector

C = bpy.context
MATS = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(name, color, metal=0.0, rough=0.5, emit=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    r, g, bl = ((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255
    lin = lambda v: v ** 2.2
    b.inputs['Base Color'].default_value = (lin(r), lin(g), lin(bl), 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit > 0:
        b.inputs['Emission Color'].default_value = (lin(r), lin(g), lin(bl), 1)
        b.inputs['Emission Strength'].default_value = emit
    MATS[name] = m
    return m


def _apply_mod(o, mod):
    C.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=mod.name)


def _fin(o, m, bevel, seg=2):
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = False
    if bevel:
        md = o.modifiers.new('bv', 'BEVEL')
        md.width = bevel; md.segments = seg; md.limit_method = 'ANGLE'; md.angle_limit = math.radians(35)
        _apply_mod(o, md)
        for p in o.data.polygons:
            p.use_smooth = True
        # keep hard-surface shading: auto smooth by angle via a weighted normal-ish trick
        md2 = o.modifiers.new('sm', 'EDGE_SPLIT'); md2.split_angle = math.radians(38); _apply_mod(o, md2)
    return o


def box(sx, sy, sz, x, y, z, m, bevel=0.004, rot=(0, 0, 0), seg=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z), rotation=rot)
    o = C.object; o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    return _fin(o, m, bevel, seg)


def cyl(r, length, x, y, z, m, axis='Y', verts=20, bevel=0.0025, r2=None, seg=1):
    rot = {'Y': (math.pi / 2, 0, 0), 'X': (0, math.pi / 2, 0), 'Z': (0, 0, 0)}[axis]
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=length, vertices=verts, location=(x, y, z), rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=length, vertices=verts, location=(x, y, z), rotation=rot)
    return _fin(C.object, m, bevel, seg)


def cut(target, cutter):
    md = target.modifiers.new('cut', 'BOOLEAN')
    md.operation = 'DIFFERENCE'; md.object = cutter; md.solver = 'EXACT'
    _apply_mod(target, md)
    bpy.data.objects.remove(cutter, do_unlink=True)


def cutter_box(sx, sy, sz, x, y, z, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z), rotation=rot)
    o = C.object; o.scale = (sx, sy, sz); bpy.ops.object.transform_apply(scale=True)
    return o


def join_by_material():
    groups = {}
    for o in [o for o in C.scene.objects if o.type == 'MESH']:
        key = o.data.materials[0].name if o.data.materials else 'none'
        groups.setdefault(key, []).append(o)
    for key, objs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        C.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        C.object.name = key


def tri_count():
    dg = C.evaluated_depsgraph_get(); n = 0
    for o in C.scene.objects:
        if o.type == 'MESH':
            n += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return n


def export(path):
    join_by_material()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True, export_materials='EXPORT', use_selection=True)


def preview(path, w=1000, h=420, view='side'):
    sc = C.scene
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = False
    sc.render.resolution_x = w; sc.render.resolution_y = h; sc.render.filepath = path
    world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.32, 0.34, 0.4, 1); bg.inputs['Strength'].default_value = 1.1
    bpy.ops.object.light_add(type='SUN', location=(2, -3, 4)); L = C.object; L.data.energy = 3.2; L.rotation_euler = (math.radians(50), 0, math.radians(35))
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in sc.objects:
        if o.type == 'MESH':
            for c in o.bound_box:
                v = o.matrix_world @ Vector(c)
                mn = Vector(map(min, mn, v)); mx = Vector(map(max, mx, v))
    ctr = (mn + mx) / 2; size = max(mx.x - mn.x, mx.y - mn.y, mx.z - mn.z)
    bpy.ops.object.camera_add(); cam = C.object; sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = size * 1.15
    if view == 'side':
        cam.location = (ctr.x + 5, ctr.y, ctr.z); d = ctr - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        cam.rotation_euler = (math.pi / 2, 0, math.pi / 2)
        cam.rotation_euler = (math.radians(90), 0, math.radians(90))
    elif view == 'iso':
        cam.data.type = 'PERSP'; cam.data.lens = 60
        cam.location = (ctr.x + size * 1.1, ctr.y - size * 1.4, ctr.z + size * 0.5)
        d = ctr - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.render.render(write_still=True)
