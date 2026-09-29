# Custom weapon models

Drop `.glb` files here and list them in `manifest.json`. Any weapon you leave out keeps its built-in low-poly model.
Weapon ids: `br`, `magnum`, `smg`, `shotgun`, `sniper`, `rocket`, `sword`.

```json
{
  "br": "br55.glb",
  "sniper": { "file": "srs99.glb", "length": 1.3, "rotY": 90 }
}
```

Per-weapon options (all optional): `length` (metres, default per weapon), `rotX/rotY/rotZ` (degrees, to face the barrel toward -Z),
`gripFromStock` (0..1, default 0.33), `gripHeight` (0..1, default 0.35), `fore` `[x,y,z]` (support-hand point), `muzzle` `[x,y,z]` (tracer origin).
With no rotation given, a model whose long axis is X is turned to Z automatically. If it points backwards, add `"rotY": 180`.

The same model is used for the first-person view, the operator's hands, and the floor pickups.
Static meshes work best. The hands are IK-driven, so the model only needs a good silhouette and origin.

**Licensing:** use models you made, bought, or that are CC0 / CC-BY (credit the author).
Do not commit game rips. `models/private/` is git-ignored for local-only files; it is read first, using its own `manifest.json`.
