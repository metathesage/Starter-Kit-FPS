using System.Collections.Generic;
using UnityEngine;

namespace CharacterRig
{
    /// Ambient behaviour for demo-bench NPCs: paces a short lane, idles, and
    /// occasionally plays a random mocap emote. Creature (Generic) animators
    /// cycle through their own clip states instead.
    public class DemoShowcase : MonoBehaviour
    {
        private static readonly string[] HumanoidEmotes =
        {
            "X_sofia_Dance", "X_sofia_Cheer", "X_sofia_Angry", "X_sofia_Wave",
            "X_sofia_Taunt", "X_sofia_Point", "X_swat_Cheer", "X_swat_Idle"
        };

        private static readonly string[] CreatureStates =
        {
            "Walk", "Run", "Flap", "Roar", "Bark", "Idle", "Rest_Pose"
        };

        [SerializeField] private float laneLength = 2.2f;

        private CharacterAnimDriver driver;
        private Animator animator;
        private Vector3 home;
        private float timer;
        private bool walking;
        private int walkDir = 1;

        private void Awake()
        {
            driver = GetComponent<CharacterAnimDriver>();
            animator = GetComponentInChildren<Animator>();
            home = transform.position;
            timer = Random.Range(0.2f, 2.5f);
        }

        private void Update()
        {
            if (animator == null) return;
            timer -= Time.deltaTime;
            if (timer > 0f)
            {
                if (walking) Step();
                return;
            }
            NextAction();
        }

        private void NextAction()
        {
            // Generic creature controllers have no Speed parameter.
            if (driver == null || !HasFloat(animator, "Speed"))
            {
                var options = new List<int>();
                for (int i = 0; i < CreatureStates.Length; i++)
                    if (animator.HasState(0, Animator.StringToHash(CreatureStates[i])))
                        options.Add(i);
                if (options.Count > 0)
                    animator.Play(CreatureStates[options[Random.Range(0, options.Count)]], 0, 0f);
                timer = Random.Range(2.5f, 6f);
                return;
            }

            int roll = Random.Range(0, 10);
            if (roll < 4) // walk the lane
            {
                walking = true;
                walkDir = Random.value < 0.5f ? -1 : 1;
                driver.SetSpeed(1.2f);
                timer = laneLength / 1.2f;
            }
            else if (roll < 7) // emote
            {
                walking = false;
                driver.SetSpeed(0f);
                var pool = new List<string>();
                foreach (var s in HumanoidEmotes)
                    if (animator.HasState(0, Animator.StringToHash(s)))
                        pool.Add(s);
                if (pool.Count > 0)
                    driver.PlayState(pool[Random.Range(0, pool.Count)]);
                timer = Random.Range(2.5f, 5f);
            }
            else // idle
            {
                walking = false;
                driver.SetSpeed(0f);
                timer = Random.Range(1.5f, 4f);
            }
        }

        private static bool HasFloat(Animator animator, string name)
        {
            foreach (var p in animator.parameters)
                if (p.type == AnimatorControllerParameterType.Float && p.name == name)
                    return true;
            return false;
        }

        private void Step()
        {
            Vector3 fwd = transform.forward * 1.2f * walkDir;
            transform.position += fwd * Time.deltaTime;
            if (Vector3.Distance(transform.position, home) > laneLength)
            {
                walkDir = -walkDir;
                Vector3 toHome = home - transform.position;
                toHome.y = 0f;
                if (toHome.sqrMagnitude > 0.01f)
                    transform.rotation = Quaternion.LookRotation(toHome);
            }
            else
            {
                transform.rotation = Quaternion.Slerp(transform.rotation,
                    Quaternion.LookRotation(fwd.normalized), 10f * Time.deltaTime);
            }
        }
    }
}
