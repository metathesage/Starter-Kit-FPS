using UnityEngine;

/// <summary>
/// Real locomotion for waifu operatives — a Unity port of the pack's
/// character.js retarget (src/character.js). The Universal Animation Library
/// (ual1_standard.glb, UE-mannequin skeleton — imported by glTFast) drives
/// VRoid rigs (J_Bip_* bones) LIVE at runtime: the source mannequin's clips
/// are sampled with AnimationClip.SampleAnimation and the mapped bones are
/// re-posed with the pack's exact quaternion math.
///
/// Math (identical to the three.js original):
///   worldDelta(t)   = qUAL(t) * inverse(qUAL_TPose)   // motion, rig-free
///   qWorldTarget(t) = worldDelta(t) * qTargetRest     // re-apply on target
///   qLocal(t)       = inverse(qWorldParent) * qWorldTarget(t)
/// State changes crossfade by sampling the outgoing clip, saving bone
/// rotations, sampling the incoming clip and slerping between the two.
/// </summary>
public class UalRig
{
    public static readonly (string ual, string vroid)[] Map =
    {
        ("pelvis",       "J_Bip_C_Hips"),
        ("spine_01",     "J_Bip_C_Spine"),
        ("spine_02",     "J_Bip_C_Chest"),
        ("spine_03",     "J_Bip_C_UpperChest"),
        ("neck_01",      "J_Bip_C_Neck"),
        ("Head",         "J_Bip_C_Head"),
        ("clavicle_l",   "J_Bip_L_Shoulder"),
        ("upperarm_l",   "J_Bip_L_UpperArm"),
        ("lowerarm_l",   "J_Bip_L_LowerArm"),
        ("hand_l",       "J_Bip_L_Hand"),
        ("thigh_l",      "J_Bip_L_UpperLeg"),
        ("calf_l",       "J_Bip_L_LowerLeg"),
        ("foot_l",       "J_Bip_L_Foot"),
        ("ball_l",       "J_Bip_L_ToeBase"),
        ("clavicle_r",   "J_Bip_R_Shoulder"),
        ("upperarm_r",   "J_Bip_R_UpperArm"),
        ("lowerarm_r",   "J_Bip_R_LowerArm"),
        ("hand_r",       "J_Bip_R_Hand"),
        ("thigh_r",      "J_Bip_R_UpperLeg"),
        ("calf_r",       "J_Bip_R_LowerLeg"),
        ("foot_r",       "J_Bip_R_Foot"),
        ("ball_r",       "J_Bip_R_ToeBase"),
    };

    // game-state -> UAL clip candidates (same CLIP_MAP as the pack)
    static readonly string[][] States =
    {
        new[] { "idle",   "Pistol_Idle_Loop", "Idle_Loop" },
        new[] { "run",    "Jog_Fwd_Loop" },
        new[] { "sprint", "Sprint_Loop", "Jog_Fwd_Loop" },
        new[] { "shoot",  "Pistol_Shoot" },
        new[] { "death",  "Death01", "Death02" },
    };

    public bool Ok { get; private set; }
    public int ClipCount { get; private set; }

    readonly GameObject srcInst;
    readonly Transform[] srcBones;
    readonly Transform[] tgtBones;
    readonly Quaternion[] srcRefW;     // source T-pose world rotations
    readonly Quaternion[] tgtRestW;    // target rest world rotations
    readonly Transform srcHips, tgtHips;
    readonly Vector3 tgtHipRest;
    readonly float hipScale, hipRefY;

    readonly System.Collections.Generic.Dictionary<string, AnimationClip> clips =
        new System.Collections.Generic.Dictionary<string, AnimationClip>();

    AnimationClip current, previous;
    float blendT = 1f;          // 0 = previous pose, 1 = current pose
    float clipTime;
    float shootUntil;
    bool dead;

    /// <summary>Wire a UAL rig onto a VRoid-rigged visual; null when unmappable.</summary>
    public static UalRig Create(GameObject target)
    {
        var srcGo = Resources.Load<GameObject>("Animation/ual1_standard");
        if (srcGo == null) { Debug.LogWarning("[UAL] library missing from Resources/Animation"); return null; }

        // glTFast imports the library as an Animator prefab; the clips are
        // loadable as AnimationClip sub-assets. Collect them by name.
        var allClips = Resources.LoadAll<AnimationClip>("Animation/ual1_standard");
        if (allClips == null || allClips.Length == 0)
        {
            Debug.LogWarning("[UAL] no AnimationClip sub-assets found in library");
            return null;
        }
        // Flag every clip legacy so runtime SampleAnimation takes the legacy path
        // (non-legacy sampling requires a live Animator — we drive bones by hand)
        foreach (var c in allClips) c.legacy = true;

        var srcInst = Object.Instantiate(srcGo);
        srcInst.name = "UALSrc";
        srcInst.hideFlags = HideFlags.HideAndDontSave;
        srcInst.SetActive(false);
        // nothing may fight our direct posing of the source rig
        foreach (var r in srcInst.GetComponentsInChildren<Renderer>(true)) Object.Destroy(r);
        foreach (var c in srcInst.GetComponentsInChildren<Collider>(true)) Object.Destroy(c);
        foreach (var a in srcInst.GetComponentsInChildren<Animation>(true)) Object.Destroy(a);
        // KEEP the Animator component (controller stripped): runtime
        // SampleAnimation on non-legacy clips REQUIRES one to be present
        foreach (var a in srcInst.GetComponentsInChildren<Animator>(true))
            a.runtimeAnimatorController = null;

        var srcMap = new System.Collections.Generic.Dictionary<string, Transform>();
        foreach (var t in srcInst.GetComponentsInChildren<Transform>(true))
            if (!string.IsNullOrEmpty(t.name) && !srcMap.ContainsKey(t.name)) srcMap[t.name] = t;

        // resolve the state table against available clips
        var resolved = new System.Collections.Generic.Dictionary<string, AnimationClip>();
        foreach (var st in States)
            foreach (var name in st)
            {
                if (st.Length == 0) continue;
                if (name == st[0]) continue;   // skip the state key itself
                var clip = System.Array.Find(allClips, c => c.name == name);
                if (clip != null && !resolved.ContainsKey(st[0])) resolved[st[0]] = clip;
            }
        if (!resolved.ContainsKey("idle") || !resolved.ContainsKey("run"))
        {
            Object.Destroy(srcInst);
            Debug.LogWarning("[UAL] library lacks idle/run clips (" + allClips.Length + " found: " + allClips[0].name + "…)");
            return null;
        }

        // map source mannequin bones onto the target's VRoid bones
        var tgtUsed = new System.Collections.Generic.HashSet<Transform>();
        var srcList = new System.Collections.Generic.List<Transform>();
        var tgtList = new System.Collections.Generic.List<Transform>();
        foreach (var t in target.GetComponentsInChildren<Transform>(true))
        {
            if (tgtUsed.Contains(t)) continue;
            foreach (var m in Map)
                if (m.vroid == t.name && srcMap.ContainsKey(m.ual))
                {
                    srcList.Add(srcMap[m.ual]);
                    tgtList.Add(t);
                    tgtUsed.Add(t);
                    break;
                }
        }
        if (tgtList.Count < 6)
        {
            Object.Destroy(srcInst);
            return null;   // not a VRoid rig
        }
        // nothing may fight our direct posing of the target rig either
        foreach (var a in target.GetComponentsInChildren<Animator>(true)) a.enabled = false;

        // T-pose reference (UAL bind is an A-pose)
        var tpose = System.Array.Find(allClips, c => c.name == "A_TPose");
        var srcRefW = new Quaternion[tgtList.Count];
        float srcHipRefY = srcMap["pelvis"].position.y;
        if (tpose != null) tpose.SampleAnimation(srcInst, 0f);
        for (int i = 0; i < tgtList.Count; i++) srcRefW[i] = srcList[i].rotation;

        var tgtRestW = new Quaternion[tgtList.Count];
        for (int i = 0; i < tgtList.Count; i++) tgtRestW[i] = tgtList[i].rotation;

        Transform srcHips = srcMap["pelvis"];
        Transform tgtHips = null;
        for (int i = 0; i < tgtList.Count; i++)
            if (tgtList[i].name == "J_Bip_C_Hips") { tgtHips = tgtList[i]; break; }
        Vector3 tgtHipRest = tgtHips ? tgtHips.localPosition : Vector3.zero;
        float hipScale = tgtHips ? tgtHips.position.y / Mathf.Max(0.01f, srcHipRefY) : 1f;

        var rig = new UalRig(srcInst, srcList.ToArray(), tgtList.ToArray(),
            srcRefW, tgtRestW, srcHips, tgtHips, tgtHipRest, hipScale, srcHipRefY, resolved);
        Debug.Log("[UAL] live retarget armed on " + target.name +
                  " (" + tgtList.Count + " bones, " + resolved.Count + " states: " +
                  string.Join(",", resolved.Keys) + ")");
        return rig;
    }

    UalRig(GameObject srcInst, Transform[] srcBones, Transform[] tgtBones,
        Quaternion[] srcRefW, Quaternion[] tgtRestW, Transform srcHips, Transform tgtHips,
        Vector3 tgtHipRest, float hipScale, float hipRefY,
        System.Collections.Generic.Dictionary<string, AnimationClip> resolved)
    {
        this.srcInst = srcInst;
        this.srcBones = srcBones;
        this.tgtBones = tgtBones;
        this.srcRefW = srcRefW;
        this.tgtRestW = tgtRestW;
        this.srcHips = srcHips;
        this.tgtHips = tgtHips;
        this.tgtHipRest = tgtHipRest;
        this.hipScale = hipScale;
        this.hipRefY = hipRefY;
        clips = resolved;
        ClipCount = resolved.Count;
        Ok = true;
    }

    public bool Has(string state) => clips.ContainsKey(state);

    /// <summary>Crossfade into a state (hard cut when it's already playing).</summary>
    public void Play(string state, float fade = 0.2f)
    {
        if (!clips.TryGetValue(state, out var clip) || clip == current) return;
        previous = current ?? clip;
        current = clip;
        clipTime = 0f;
        blendT = fade <= 0f ? 1f : 0f;
        blendSpeed = fade <= 0f ? 1f : 1f / fade;
    }

    float blendSpeed = 5f;

    /// <summary>Advance state timers (call once per frame with Time.deltaTime).</summary>
    public void Tick(float dt)
    {
        if (current == null) return;
        clipTime = Mathf.Repeat(clipTime + dt, current.length);
        blendT = Mathf.MoveTowards(blendT, 1f, blendSpeed * dt);
    }

    /// <summary>Pose the target rig from the sampled source. Call every frame.</summary>
    public void Pose()
    {
        if (current == null) return;

        // sample current clip; if blending, save current pose, sample previous,
        // then slerp each source bone between the two before retargeting
        current.SampleAnimation(srcInst, clipTime);
        if (blendT < 1f && previous != null)
        {
            var blended = new Quaternion[srcBones.Length];
            for (int i = 0; i < srcBones.Length; i++) blended[i] = srcBones[i].localRotation;
            previous.SampleAnimation(srcInst, clipTime);
            for (int i = 0; i < srcBones.Length; i++)
                srcBones[i].localRotation = Quaternion.Slerp(srcBones[i].localRotation, blended[i], blendT);
        }

        var parentWorld = new Quaternion[tgtBones.Length];
        for (int i = 0; i < tgtBones.Length; i++)
        {
            // parent world rotation: cached mapped parent, else rest chain to root
            Quaternion pw = Quaternion.identity;
            var p = tgtBones[i].parent;
            var restChain = new System.Collections.Generic.List<Quaternion>();
            while (p != null)
            {
                int idx = IndexOf(p);
                if (idx >= 0 && idx < i) { pw = parentWorld[idx]; break; }
                restChain.Add(p.localRotation);
                p = p.parent;
            }
            for (int r = restChain.Count - 1; r >= 0; r--) pw = pw * restChain[r];

            Quaternion delta = srcBones[i].rotation * Quaternion.Inverse(srcRefW[i]);
            Quaternion qWorld = delta * tgtRestW[i];
            tgtBones[i].localRotation = Quaternion.Inverse(pw) * qWorld;
            parentWorld[i] = qWorld;
        }

        if (tgtHips && srcHips)
        {
            float dy = (srcHips.position.y - hipRefY) * hipScale;
            tgtHips.localPosition = tgtHipRest + Vector3.up * dy;
        }
    }

    // ---- state helpers used by WaifuAnimator ----

    public void Shoot(float duration = 0.45f) => shootUntil = Time.time + duration;
    public bool Shooting => Time.time < shootUntil;
    public void MarkDead() => dead = true;

    public void Dispose()
    {
        if (srcInst) Object.Destroy(srcInst);
    }

    int IndexOf(Transform t)
    {
        for (int i = 0; i < tgtBones.Length; i++) if (tgtBones[i] == t) return i;
        return -1;
    }
}
