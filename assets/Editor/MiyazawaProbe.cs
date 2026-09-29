using System.Linq;
using UnityEditor;
using UnityEngine;

public static class MiyazawaProbe
{
    public static void Run()
    {
        if (System.Environment.GetCommandLineArgs().Any(a => a == "-forceReimport"))
        {
            Debug.Log("[Probe] regen avatar via Generic->Human toggle");
            var mi = AssetImporter.GetAtPath("Assets/Characters/Miyazawa/chr100_000_00.fbx") as ModelImporter;
            mi.animationType = ModelImporterAnimationType.Generic;
            mi.SaveAndReimport();
            mi = AssetImporter.GetAtPath("Assets/Characters/Miyazawa/chr100_000_00.fbx") as ModelImporter;
            mi.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
            mi.animationType = ModelImporterAnimationType.Human;
            mi.SaveAndReimport();
        }
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Characters/Miyazawa/Miyazawa_AnimReady.prefab");
        var ctrl = AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>("Assets/Animations/Controllers/CharacterAnim.controller");
        Debug.Log($"[Probe] prefab={(prefab != null)} controller={(ctrl != null)}");
        var go = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        go.transform.position = Vector3.zero;
        var anim = go.GetComponentInChildren<Animator>();
        Debug.Log($"[Probe] animator={(anim != null)} enabled={anim.enabled} avatar={(anim.avatar != null)} isHuman={(anim.avatar != null && anim.avatar.isHuman)}");
        var imp = AssetImporter.GetAtPath("Assets/Characters/Miyazawa/chr100_000_00.fbx") as ModelImporter;
        if (imp != null)
            Debug.Log($"[Probe] importer avatarSetup={imp.avatarSetup} animType={imp.animationType}");
        anim.runtimeAnimatorController = ctrl;
        anim.cullingMode = AnimatorCullingMode.AlwaysAnimate;
        anim.SetFloat("Speed", 1.5f);
        anim.Play("Base Layer.Walk");
        var shin = anim.GetBoneTransform(HumanBodyBones.LeftLowerLeg);
        Debug.Log($"[Probe] shin={(shin != null ? shin.name : "NULL")}");
        Debug.Log($"[Probe] speed={anim.speed} fireEvents={anim.fireEvents} applyRootMotion={anim.applyRootMotion} updateMode={anim.updateMode} culling={anim.cullingMode}");
        anim.speed = 1f; // in case prefab serialized speed 0
        float total = 0; var prev = shin.localRotation;
        for (int i = 0; i < 20; i++)
        {
            anim.Update(0.05f);
            total += Quaternion.Angle(prev, shin.localRotation);
            prev = shin.localRotation;
        }
        Debug.Log($"[Probe] walk total={total:F1}deg");
        // also drive the raw walk clip directly to isolate avatar vs clip
        var clip = AssetDatabase.LoadAssetAtPath<AnimationClip>("Assets/Animations/Derived/walk.anim");
        if (clip != null)
        {
            var prev2 = shin.localRotation; float t2 = 0;
            clip.SampleAnimation(go, 0.3f);
            t2 = Quaternion.Angle(prev2, shin.localRotation);
            Debug.Log($"[Probe] rawClipSample delta={t2:F1}deg");
        }
        Object.DestroyImmediate(go);
        // control test: raw FBX model instance instead of prefab
        var fbx = AssetDatabase.LoadAllAssetsAtPath("Assets/Characters/Miyazawa/chr100_000_00.fbx")
            .OfType<GameObject>().FirstOrDefault(g => g.transform.parent == null
                && g.GetComponentInChildren<SkinnedMeshRenderer>() != null);
        if (fbx != null)
        {
            var raw = (GameObject)PrefabUtility.InstantiatePrefab(fbx);
            raw.transform.position = Vector3.zero;
            var ra = raw.GetComponentInChildren<Animator>();
            ra.runtimeAnimatorController = ctrl;
            ra.cullingMode = AnimatorCullingMode.AlwaysAnimate;
            ra.SetFloat("Speed", 1.5f);
            ra.Play("Base Layer.Walk");
            var rs = ra.GetBoneTransform(HumanBodyBones.LeftLowerLeg);
            float t3 = 0; var p3 = rs.localRotation;
            for (int i = 0; i < 20; i++) { ra.Update(0.05f); t3 += Quaternion.Angle(p3, rs.localRotation); p3 = rs.localRotation; }
            Debug.Log($"[Probe] RAW model walk total={t3:F1}deg");
            Object.DestroyImmediate(raw);
        }
        Debug.Log("[Probe] ===== PROBE DONE =====");
    }
}
