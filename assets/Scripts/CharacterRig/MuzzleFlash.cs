using System.Collections;
using UnityEngine;

namespace CharacterRig
{
    /// Zero-asset muzzle flash: point light + emissive quad, spawned at a muzzle
    /// transform and self-destructed. Works in Built-in RP with no particles setup.
    public static class MuzzleFlash
    {
        private static Material flashMat;

        public static void Spawn(Transform muzzle, float range = 6f, float duration = 0.06f)
        {
            if (muzzle == null) return;

            var go = new GameObject("MuzzleFlash");
            go.transform.position = muzzle.position;
            go.transform.rotation = muzzle.rotation;

            var light = go.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = new Color(1f, 0.85f, 0.5f);
            light.intensity = 8f;
            light.range = range;

            var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Object.Destroy(quad.GetComponent<Collider>());
            quad.name = "FlashQuad";
            quad.transform.SetParent(go.transform, false);
            quad.transform.localPosition = Vector3.forward * 0.05f;
            quad.transform.localScale = Vector3.one * 0.18f;
            if (flashMat == null)
            {
                var shader = Shader.Find("Unlit/Color");
                flashMat = new Material(shader) { hideFlags = HideFlags.HideAndDontSave };
                flashMat.color = new Color(1f, 0.9f, 0.6f);
            }
            quad.GetComponent<Renderer>().sharedMaterial = flashMat;

            go.AddComponent<MuzzleFlashLife>().life = duration;
        }

        private class MuzzleFlashLife : MonoBehaviour
        {
            public float life = 0.06f;
            private void Update()
            {
                life -= Time.deltaTime;
                if (life <= 0f) Destroy(gameObject);
            }
        }
    }
}
