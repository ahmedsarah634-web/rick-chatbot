import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const Rick3DViewer = ({ 
  isPlayingAudio, 
  isThinking = false,
  modelUrl = '/models/rick.glb', 
  backgroundImageUrl = null, 
  isLoading = false 
}) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const mixerRef = useRef(null);
  const modelRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const animationsRef = useRef({ idle: [], talk: [], thinking: [] });
  const currentActionRef = useRef(null);
  const controlsRef = useRef(null);

  // Lip sync refs
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const audioContextRef = useRef(null);
  const mouthMeshRef = useRef(null);

  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!mountRef.current) return;

    let animationFrameId;
    let mounted = true;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    if (backgroundImageUrl) {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(backgroundImageUrl, (texture) => {
        scene.background = texture;
      });
    } else {
      scene.background = new THREE.Color(0x000000);
    }

    const camera = new THREE.PerspectiveCamera(
      45,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    currentMount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (!mounted) return;

        const model = gltf.scene;
        modelRef.current = model;

        // Find morph targets for mouth
        model.traverse((child) => {
          if (child.isMesh && child.morphTargetInfluences) {
            mouthMeshRef.current = child;
            console.log("Lip sync mesh found:", child.name);
          }
        });

        scene.add(model);

        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;

          gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            const name = clip.name.toLowerCase();
            if (name.includes('idle')) animationsRef.current.idle.push(action);
            else if (name.includes('talk')) animationsRef.current.talk.push(action);
            else if (name.includes('think')) animationsRef.current.thinking.push(action);
          });

          if (animationsRef.current.idle.length > 0) {
            const idle = animationsRef.current.idle[0];
            idle.play();
            currentActionRef.current = idle;
          }
        }

        setModelLoaded(true);
      },
      (xhr) => {
        const progress = (xhr.loaded / xhr.total) * 100;
        setLoadingProgress(progress);
      },
      (error) => {
        setError(error.message);
      }
    );

    const animate = () => {
      if (!mounted) return;

      animationFrameId = requestAnimationFrame(animate);

      const delta = clockRef.current.getDelta();

      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      // Lip Sync
      if (analyserRef.current && mouthMeshRef.current && isPlayingAudio) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);

        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sum += dataArrayRef.current[i];
        }

        const volume = sum / dataArrayRef.current.length;

        if (mouthMeshRef.current.morphTargetInfluences) {
          mouthMeshRef.current.morphTargetInfluences[0] = volume / 80;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      mounted = false;
      cancelAnimationFrame(animationFrameId);
      if (currentMount && renderer) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl, backgroundImageUrl]);

  // Setup Audio Analyzer when Rick talks
  useEffect(() => {
    if (!isPlayingAudio) return;

    const audio = document.querySelector('audio');
    if (!audio) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaElementSource(audio);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);

      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
    }
  }, [isPlayingAudio]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" style={{ minHeight: '400px' }} />

      {!modelLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-center text-[#ff5e00]">
            Loading model... {Math.round(loadingProgress)}%
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-[#ff5e00] text-center">{error}</div>
        </div>
      )}
    </div>
  );
};

export default Rick3DViewer;
