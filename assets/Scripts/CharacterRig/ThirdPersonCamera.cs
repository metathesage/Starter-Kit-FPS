using UnityEngine;

namespace CharacterRig
{
    /// Minimal demo camera: follows the target, right-mouse drag orbits yaw.
    public class ThirdPersonCamera : MonoBehaviour
    {
        public Transform target;
        public float distance = 3.2f;
        public float height = 1.6f;
        public float orbitSpeed = 4f;
        public Vector3 lookOffset = Vector3.up * 1.1f;

        private float yaw;

        private void LateUpdate()
        {
            if (target == null) return;
            if (Input.GetMouseButton(1))
                yaw += Input.GetAxis("Mouse X") * orbitSpeed;

            Vector3 offset = Quaternion.Euler(0f, yaw, 0f) * (Vector3.back * distance);
            transform.position = target.position + offset + Vector3.up * height;
            transform.LookAt(target.position + lookOffset);
        }
    }
}
