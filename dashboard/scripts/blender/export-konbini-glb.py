"""Export rainy_konbini.blend to a web glTF (run with blender -b file --python this -- out.glb)."""
import bpy, sys
out = sys.argv[sys.argv.index("--") + 1]
SKIP = ("RainDrop", "Drip", "Ripple", "GlassDrop")
for o in list(bpy.data.objects):
    base = o.name.split(".")[0]
    if base.startswith(SKIP) or o.type in ("CAMERA", "LIGHT"):
        bpy.data.objects.remove(o, do_unlink=True)
bpy.context.scene.frame_set(1)
# text + wire curves -> mesh
for o in list(bpy.data.objects):
    if o.type in ("FONT", "CURVE"):
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.object.convert(target="MESH")
        if o.name.startswith("Text"): o.name = "SignText"
# flatten toon node trees to Principled + extras
for m in bpy.data.materials:
    if not m.use_nodes: continue
    N = m.node_tree.nodes
    col = (0.8, 0.8, 0.8, 1); emit = 0.0
    for n in N:
        if n.type == "MIX" and getattr(n, "data_type", "") == "RGBA": col = tuple(n.inputs[6].default_value)
        if n.type == "EMISSION" and n.name == "GLOW": emit = n.inputs[1].default_value
    m.animation_data_clear(); m.node_tree.animation_data_clear()
    for n in list(N): N.remove(n)
    o = N.new("ShaderNodeOutputMaterial"); p = N.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = col
    p.inputs["Roughness"].default_value = 0.8
    if emit > 0:
        p.inputs["Emission Color"].default_value = col; p.inputs["Emission Strength"].default_value = min(emit, 4)
    m.node_tree.links.new(p.outputs[0], o.inputs[0])
    m["tt_color"] = list(col[:3]); m["tt_emit"] = float(emit)
for o in bpy.data.objects:
    o.animation_data_clear()
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True, export_extras=True,
    export_animations=False, export_cameras=False, export_lights=False,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
print("EXPORTED", out)
