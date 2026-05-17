"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  useAnimations,
  useGLTF,
} from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";

type PlaybackMode = "loop" | "once";

type AnimationOption = {
  description: string;
  label: string;
  name: string;
  playback: PlaybackMode;
};

const MODEL_PATH = "/models/character.glb";

const FALLBACK_ANIMATIONS: AnimationOption[] = [
  {
    name: "idle",
    label: "Idle",
    description: "Default neutral pose. Use this as your landing state.",
    playback: "loop",
  },
  {
    name: "wave",
    label: "Wave",
    description: "A quick greeting gesture for button or chat triggers.",
    playback: "once",
  },
  {
    name: "talk",
    label: "Talk",
    description: "Looping motion for future chat and voice responses.",
    playback: "loop",
  },
  {
    name: "celebrate",
    label: "Celebrate",
    description: "A higher-energy one-shot animation with a clean return to idle.",
    playback: "once",
  },
];

function buildModelAnimations(animationNames: string[]): AnimationOption[] {
  return animationNames.map((name) => {
    const normalized = name.toLowerCase();
    const playback: PlaybackMode =
      normalized.includes("idle") ||
      normalized.includes("talk") ||
      normalized.includes("walk") ||
      normalized.includes("run") ||
      normalized.includes("loop")
        ? "loop"
        : "once";

    return {
      name,
      playback,
      label: name
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase()),
      description:
        playback === "loop"
          ? "Looping clip detected from your imported GLB."
          : "One-shot clip detected from your imported GLB.",
    };
  });
}

function getIdleAnimationName(animationNames: string[]): string {
  const idleMatch = animationNames.find((name) => name.toLowerCase().includes("idle"));
  return idleMatch ?? animationNames[0] ?? FALLBACK_ANIMATIONS[0].name;
}

function getNextAnimation(
  currentAnimation: string,
  animationOptions: AnimationOption[],
): string {
  if (animationOptions.length === 0) {
    return currentAnimation;
  }

  const currentIndex = animationOptions.findIndex(
    (animation) => animation.name === currentAnimation,
  );
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % animationOptions.length : 0;

  return animationOptions[nextIndex]?.name ?? currentAnimation;
}

export default function CharacterPrototype() {
  const [activeAnimation, setActiveAnimation] = useState(FALLBACK_ANIMATIONS[0].name);
  const [modelAnimationNames, setModelAnimationNames] = useState<string[]>([]);
  const [modelStatus, setModelStatus] = useState<"checking" | "found" | "missing">("checking");

  useEffect(() => {
    let isCancelled = false;

    fetch(MODEL_PATH, { cache: "no-store", method: "HEAD" })
      .then((response) => {
        if (!isCancelled) {
          setModelStatus(response.ok ? "found" : "missing");
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setModelStatus("missing");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const animationOptions = useMemo(() => {
    if (modelStatus === "found" && modelAnimationNames.length > 0) {
      return buildModelAnimations(modelAnimationNames);
    }

    return FALLBACK_ANIMATIONS;
  }, [modelAnimationNames, modelStatus]);

  const idleAnimation = useMemo(
    () =>
      modelStatus === "found" && modelAnimationNames.length > 0
        ? getIdleAnimationName(modelAnimationNames)
        : FALLBACK_ANIMATIONS[0].name,
    [modelAnimationNames, modelStatus],
  );

  const resolvedAnimation = animationOptions.some(
    (animation) => animation.name === activeAnimation,
  )
    ? activeAnimation
    : idleAnimation;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      event.preventDefault();
      setActiveAnimation(getNextAnimation(resolvedAnimation, animationOptions));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [animationOptions, resolvedAnimation]);

  const activeAnimationOption =
    animationOptions.find((animation) => animation.name === resolvedAnimation) ??
    animationOptions[0];

  const usingImportedModel = modelStatus === "found" && modelAnimationNames.length > 0;

  const handleModelAnimationsLoaded = useCallback((animationNames: string[]) => {
    setModelAnimationNames(animationNames);
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.75),_rgba(244,241,232,0.92)_42%,_#d6e4df_100%)] px-6 py-8 text-slate-950 sm:px-10 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative min-h-[560px] overflow-hidden rounded-[32px] border border-white/70 bg-slate-950 shadow-[0_24px_80px_rgba(16,34,42,0.18)]">
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-black/20 px-6 py-4 text-sm text-white/78 backdrop-blur-md">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.25em] text-white/50">
                  Prototype viewport
                </p>
                <p className="mt-1 font-medium text-white">
                  {usingImportedModel ? "Imported GLB active" : "Fallback motion rig active"}
                </p>
              </div>
              <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/80">
                {activeAnimationOption?.label ?? "Animation"}
              </div>
            </div>

            <CharacterCanvas
              activeAnimation={resolvedAnimation}
              idleAnimation={idleAnimation}
              modelStatus={modelStatus}
              onAnimationFinished={() => setActiveAnimation(idleAnimation)}
              onModelAnimationsLoaded={handleModelAnimationsLoaded}
            />
          </div>

          <aside className="flex flex-col gap-5 rounded-[32px] border border-slate-900/8 bg-white/78 p-6 shadow-[0_18px_60px_rgba(16,34,42,0.1)] backdrop-blur">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-teal-900/12 bg-teal-600/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-teal-900">
                Next.js + React Three Fiber
              </div>
              <h1 className="max-w-sm text-4xl font-semibold tracking-tight text-slate-950">
                Character control prototype for the web.
              </h1>
              <p className="text-base leading-7 text-slate-700">
                This gives you the base interaction loop you described: a 3D viewport,
                animation state switching, button controls, and a keyboard trigger that can
                later be driven by chat or voice events.
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-900/8 bg-slate-950 p-5 text-white">
              <p className="text-sm uppercase tracking-[0.2em] text-white/45">
                Current setup
              </p>
              <p className="mt-3 text-2xl font-semibold">
                {activeAnimationOption?.label ?? "Idle"}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                {activeAnimationOption?.description ??
                  "Choose an animation to test the controller."}
              </p>
              <button
                type="button"
                onClick={() =>
                  setActiveAnimation(getNextAnimation(resolvedAnimation, animationOptions))
                }
                className="mt-5 flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,_#e3ff8a,_#72f1bf)] px-4 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
              >
                Trigger next animation
              </button>
              <p className="mt-3 text-xs text-white/55">
                Press <kbd className="rounded border border-white/15 px-1.5 py-0.5">Space</kbd>{" "}
                to cycle animations from the keyboard.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Animation states
              </p>
              <div className="grid gap-2">
                {animationOptions.map((animation) => {
                  const isActive = animation.name === resolvedAnimation;

                  return (
                    <button
                      key={animation.name}
                      type="button"
                      onClick={() => setActiveAnimation(animation.name)}
                      className={`rounded-[22px] border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-teal-400 bg-teal-500/12 text-slate-950 shadow-[0_8px_30px_rgba(19,78,74,0.14)]"
                          : "border-slate-900/8 bg-white/70 text-slate-700 hover:border-teal-500/30 hover:bg-teal-500/6"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{animation.label}</span>
                        <span className="rounded-full border border-current/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-current/65">
                          {animation.playback}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-current/80">
                        {animation.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-dashed border-slate-900/10 bg-slate-50/80 p-4 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-950">To use your own Mixamo export:</p>
              <p className="mt-2">
                Put your file at <code className="rounded bg-white px-1.5 py-0.5 text-xs">
                  public/models/character.glb
                </code>
                . The UI will detect it, load its animation clips, and switch from the
                placeholder rig to your imported character automatically.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

type CharacterCanvasProps = {
  activeAnimation: string;
  idleAnimation: string;
  modelStatus: "checking" | "found" | "missing";
  onAnimationFinished: () => void;
  onModelAnimationsLoaded: (animationNames: string[]) => void;
};

function CharacterCanvas({
  activeAnimation,
  idleAnimation,
  modelStatus,
  onAnimationFinished,
  onModelAnimationsLoaded,
}: CharacterCanvasProps) {
  return (
    <Canvas
      camera={{ fov: 34, position: [0, 1.3, 6.8] }}
      className="h-full w-full"
      shadows="percentage"
    >
      <color attach="background" args={["#081217"]} />
      <fog attach="fog" args={["#081217", 8, 16]} />
      <ambientLight intensity={0.8} />
      <directionalLight
        castShadow
        intensity={2}
        position={[4, 7, 4]}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
      />
      <directionalLight intensity={1} position={[-5, 3, -2]} color="#7de7d0" />

      <Suspense
        fallback={
          <Html center>
            <div className="rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm text-white backdrop-blur">
              Loading character model...
            </div>
          </Html>
        }
      >
        {modelStatus === "found" ? (
          <RiggedCharacter
            activeAnimation={activeAnimation}
            idleAnimation={idleAnimation}
            onAnimationFinished={onAnimationFinished}
            onModelAnimationsLoaded={onModelAnimationsLoaded}
          />
        ) : (
          <PrototypeCharacter activeAnimation={activeAnimation} />
        )}
      </Suspense>

      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1.4, 0]}>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#11252f" metalness={0.1} roughness={0.92} />
      </mesh>

      <ContactShadows
        blur={2.2}
        color="#0b3f4b"
        far={2.6}
        opacity={0.85}
        position={[0, -1.39, 0]}
        resolution={512}
      />

      <Environment preset="city" />
      <OrbitControls
        enablePan={false}
        maxDistance={8}
        maxPolarAngle={Math.PI / 1.7}
        minDistance={4}
        minPolarAngle={Math.PI / 3.4}
        target={[0, 0.55, 0]}
      />
    </Canvas>
  );
}

type RiggedCharacterProps = {
  activeAnimation: string;
  idleAnimation: string;
  onAnimationFinished: () => void;
  onModelAnimationsLoaded: (animationNames: string[]) => void;
};

function RiggedCharacter({
  activeAnimation,
  idleAnimation,
  onAnimationFinished,
  onModelAnimationsLoaded,
}: RiggedCharacterProps) {
  const group = useRef<THREE.Group>(null);
  const { animations, scene } = useGLTF(MODEL_PATH);
  const model = useMemo(() => {
    const clonedScene = clone(scene);
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.8 / maxAxis;

    clonedScene.position.set(-center.x, -box.min.y, -center.z);
    clonedScene.scale.setScalar(scale);

    return clonedScene;
  }, [scene]);
  const { actions, mixer, names } = useAnimations(animations, group);
  const previousAction = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    onModelAnimationsLoaded(names);
  }, [names, onModelAnimationsLoaded]);

  useEffect(() => {
    if (names.length === 0 || !actions) {
      return;
    }

    const fallbackActionName = getIdleAnimationName(names);
    const nextAction = actions[activeAnimation] ?? actions[fallbackActionName];
    if (!nextAction) {
      return;
    }

    const shouldLoop = activeAnimation === idleAnimation || nextAction === actions[idleAnimation];

    nextAction.reset();
    nextAction.setLoop(shouldLoop ? THREE.LoopRepeat : THREE.LoopOnce, shouldLoop ? Infinity : 1);
    nextAction.fadeIn(0.3);
    nextAction.play();

    if (previousAction.current && previousAction.current !== nextAction) {
      previousAction.current.fadeOut(0.3);
    }

    previousAction.current = nextAction;

    return () => {
      if (previousAction.current === nextAction) {
        nextAction.fadeOut(0.2);
      }
    };
  }, [actions, activeAnimation, idleAnimation, names]);

  useEffect(() => {
    const handleFinished = (event: THREE.Event & { action?: THREE.AnimationAction }) => {
      if (!actions || !event.action || activeAnimation === idleAnimation) {
        return;
      }

      const activeAction = actions[activeAnimation];
      if (activeAction && event.action === activeAction) {
        onAnimationFinished();
      }
    };

    mixer.addEventListener("finished", handleFinished);
    return () => {
      mixer.removeEventListener("finished", handleFinished);
    };
  }, [actions, activeAnimation, idleAnimation, mixer, onAnimationFinished]);

  return (
    <group ref={group} position={[0, -1.4, 0]} castShadow>
      <primitive object={model} />
    </group>
  );
}

function PrototypeCharacter({ activeAnimation }: { activeAnimation: string }) {
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const breathe = Math.sin(elapsed * 1.6) * 0.02;
    const sway = Math.sin(elapsed * 1.25) * 0.08;
    const dance = Math.sin(elapsed * 5.5);
    const target = {
      headY: 0.96 + breathe,
      leftArmX: sway * 0.35,
      leftArmZ: -0.22,
      rightArmX: -sway * 0.35,
      rightArmZ: 0.22,
      torsoY: breathe * 0.4,
      torsoZ: 0,
      leftLegX: -sway * 0.25,
      rightLegX: sway * 0.25,
    };

    if (activeAnimation === "wave") {
      target.rightArmX = -0.2 + dance * 0.45;
      target.rightArmZ = -1.05;
      target.leftArmX = 0.18;
      target.torsoZ = -0.08;
    }

    if (activeAnimation === "talk") {
      target.leftArmX = dance * 0.18;
      target.rightArmX = -dance * 0.18;
      target.leftArmZ = -0.38 + dance * 0.06;
      target.rightArmZ = 0.38 - dance * 0.06;
      target.headY = 0.98 + breathe + Math.sin(elapsed * 4.5) * 0.04;
      target.torsoY = Math.sin(elapsed * 4.5) * 0.05;
    }

    if (activeAnimation === "celebrate") {
      target.leftArmX = Math.PI * 0.78 + dance * 0.1;
      target.rightArmX = Math.PI * 0.78 - dance * 0.1;
      target.leftArmZ = -0.2;
      target.rightArmZ = 0.2;
      target.leftLegX = dance * 0.25;
      target.rightLegX = -dance * 0.25;
      target.headY = 1.02 + Math.abs(Math.sin(elapsed * 5.5)) * 0.1;
      target.torsoY = Math.abs(Math.sin(elapsed * 5.5)) * 0.08;
    }

    if (torso.current) {
      torso.current.position.y = THREE.MathUtils.damp(
        torso.current.position.y,
        target.torsoY,
        6,
        delta,
      );
      torso.current.rotation.z = THREE.MathUtils.damp(
        torso.current.rotation.z,
        target.torsoZ,
        6,
        delta,
      );
    }

    if (head.current) {
      head.current.position.y = THREE.MathUtils.damp(
        head.current.position.y,
        target.headY,
        6,
        delta,
      );
    }

    if (leftArm.current) {
      leftArm.current.rotation.x = THREE.MathUtils.damp(
        leftArm.current.rotation.x,
        target.leftArmX,
        6,
        delta,
      );
      leftArm.current.rotation.z = THREE.MathUtils.damp(
        leftArm.current.rotation.z,
        target.leftArmZ,
        6,
        delta,
      );
    }

    if (rightArm.current) {
      rightArm.current.rotation.x = THREE.MathUtils.damp(
        rightArm.current.rotation.x,
        target.rightArmX,
        6,
        delta,
      );
      rightArm.current.rotation.z = THREE.MathUtils.damp(
        rightArm.current.rotation.z,
        target.rightArmZ,
        6,
        delta,
      );
    }

    if (leftLeg.current) {
      leftLeg.current.rotation.x = THREE.MathUtils.damp(
        leftLeg.current.rotation.x,
        target.leftLegX,
        6,
        delta,
      );
    }

    if (rightLeg.current) {
      rightLeg.current.rotation.x = THREE.MathUtils.damp(
        rightLeg.current.rotation.x,
        target.rightLegX,
        6,
        delta,
      );
    }
  });

  return (
    <group position={[0, -0.28, 0]} scale={0.72}>
      <group ref={torso}>
        <mesh castShadow position={[0, 0.2, 0]}>
          <capsuleGeometry args={[0.42, 1.25, 8, 16]} />
          <meshStandardMaterial color="#90f2c8" metalness={0.1} roughness={0.45} />
        </mesh>

        <mesh ref={head} castShadow position={[0, 0.96, 0]}>
          <sphereGeometry args={[0.34, 32, 32]} />
          <meshStandardMaterial color="#ffe2b2" roughness={0.6} />
        </mesh>

        <group ref={leftArm} position={[-0.48, 0.62, 0]}>
          <mesh castShadow position={[0, -0.45, 0]}>
            <capsuleGeometry args={[0.12, 0.8, 6, 12]} />
            <meshStandardMaterial color="#5fd0de" roughness={0.42} />
          </mesh>
        </group>

        <group ref={rightArm} position={[0.48, 0.62, 0]}>
          <mesh castShadow position={[0, -0.45, 0]}>
            <capsuleGeometry args={[0.12, 0.8, 6, 12]} />
            <meshStandardMaterial color="#5fd0de" roughness={0.42} />
          </mesh>
        </group>

        <group ref={leftLeg} position={[-0.18, -0.45, 0]}>
          <mesh castShadow position={[0, -0.55, 0]}>
            <capsuleGeometry args={[0.13, 0.92, 6, 12]} />
            <meshStandardMaterial color="#233f4a" roughness={0.58} />
          </mesh>
        </group>

        <group ref={rightLeg} position={[0.18, -0.45, 0]}>
          <mesh castShadow position={[0, -0.55, 0]}>
            <capsuleGeometry args={[0.13, 0.92, 6, 12]} />
            <meshStandardMaterial color="#233f4a" roughness={0.58} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
