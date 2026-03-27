import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const Rick3DViewer = ({ 
  isPlayingAudio, 
  isThinking = false, // New prop for thinking state
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
  const animationsRef = useRef({
    idle: [],
    talk: [],
    thinking: []
  });
  const currentActionRef = useRef(null);
  const controlsRef = useRef(null);
  
  const [modelLoaded, setModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState(null);

  const normalizeModel = (model) => {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    model.position.x = -center.x;
    model.position.y = -center.y;
    model.position.z = -center.z;
    
    const maxDimension = Math.max(size.x, size.y, size.z);
    const targetSize = 3;
    const scale = maxDimension > 0.01 ? targetSize / maxDimension : 1;
    model.scale.setScalar(scale);
    
    const updatedBox = new THREE.Box3().setFromObject(model);
    const updatedSize = updatedBox.getSize(new THREE.Vector3());
    
    model.position.y = (updatedSize.y / 2) - (updatedSize.y * 0.7);
    
    return { size: updatedSize, center: updatedBox.getCenter(new THREE.Vector3()) };
  };

  const adjustCameraForModel = (camera, controls, modelInfo) => {
    const distance = Math.max(modelInfo.size.x, modelInfo.size.y, modelInfo.size.z) * 1.2;
    const height = modelInfo.size.y * 0.3;
    
    camera.position.set(distance * 0.6, height + distance * 0.4, distance * 0.7);
    camera.lookAt(0, height, 0);
    
    if (controls) {
      controls.target.set(0, height, 0);
      controls.minDistance = distance * 0.2;
      controls.maxDistance = distance * 2;
      controls.update();
    }
  };

  const getRandomAnimation = (category) => {
    const animations = animationsRef.current[category];
    if (!animations || animations.length === 0) {
      console.warn(`No animations found for category: ${category}`);
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * animations.length);
    return {
      action: animations[randomIndex],
      index: randomIndex
    };
  };

  const startAnimation = (action, animationName) => {
    if (!action) return;
    
    try {
      action.reset();
      action.setLoop(THREE.LoopRepeat);
      action.clampWhenFinished = false;
      action.enabled = true;
      action.setEffectiveWeight(1.0);
      action.setEffectiveTimeScale(1.0);
      action.play();
    } catch (error) {
      console.error(`Error starting animation ${animationName}:`, error);
    }
  };

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

        const modelInfo = normalizeModel(model);
        adjustCameraForModel(camera, controls, modelInfo);
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

  useEffect(() => {
    if (!modelLoaded || !mixerRef.current) return;

    let targetAnimationCategory = 'idle';
    if (isThinking) targetAnimationCategory = 'thinking';
    else if (isPlayingAudio) targetAnimationCategory = 'talk';

    const randomAnimation = getRandomAnimation(targetAnimationCategory);
    if (!randomAnimation) return;

    const targetAction = randomAnimation.action;

    if (targetAction !== currentActionRef.current) {
      if (currentActionRef.current) {
        currentActionRef.current.fadeOut(0.5);
      }

      targetAction.reset();
      targetAction.fadeIn(0.5);
      targetAction.play();
      currentActionRef.current = targetAction;
    }
  }, [isPlayingAudio, isThinking, modelLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" style={{ minHeight: '400px' }} />

      {!modelLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-[#ff5e00]">
            Loading model... {Math.round(loadingProgress)}%
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-[#ff5e00]">{error}</div>
        </div>
      )}
    </div>
  );
};

export default Rick3DViewer;
