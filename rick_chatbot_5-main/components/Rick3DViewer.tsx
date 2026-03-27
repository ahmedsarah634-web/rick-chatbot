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
    idle: [], // Will store multiple idle animations
    talk: [], // Will store multiple talking animations
    thinking: [] // Will store multiple thinking animations
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
    // Increase the target size to make Rick larger
    const targetSize = 3;
    const scale = maxDimension > 0.01 ? targetSize / maxDimension : 1;
    model.scale.setScalar(scale);
    
    const updatedBox = new THREE.Box3().setFromObject(model);
    const updatedSize = updatedBox.getSize(new THREE.Vector3());
    
    // Lower Rick's vertical position by adding a negative offset
    // Original: model.position.y = updatedSize.y / 2;
    // Now we lower by 40% of his height
    model.position.y = (updatedSize.y / 2) - (updatedSize.y * 0.7);
    
    return { size: updatedSize, center: updatedBox.getCenter(new THREE.Vector3()) };
  };

  const adjustCameraForModel = (camera, controls, modelInfo) => {
    // Reduce the distance multiplier from 2 to 1.2 to bring Rick closer
    const distance = Math.max(modelInfo.size.x, modelInfo.size.y, modelInfo.size.z) * 1.2;
    // Lower the camera target height to match Rick's new lower position
    const height = modelInfo.size.y * 0.3;
    
    // Adjust camera position - reduce z distance to bring Rick closer to the viewer
    camera.position.set(distance * 0.6, height + distance * 0.4, distance * 0.7);
    camera.lookAt(0, height, 0);
    
    if (controls) {
      controls.target.set(0, height, 0);
      // Reduce min and max distance to keep Rick from being moved too far by orbit controls
      controls.minDistance = distance * 0.2;
      controls.maxDistance = distance * 2;
      controls.update();
    }
  };

  // Function to select a random animation from a category
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

  // Function to start an animation properly
  const startAnimation = (action, animationName) => {
    if (!action) {
      console.warn(`Cannot start null animation: ${animationName}`);
      return;
    }
    
    try {
      // Reset the action to its initial state
      action.reset();
      
      // Set it to play once to ensure it starts
      action.setLoop(THREE.LoopRepeat);
      action.clampWhenFinished = false;
      action.enabled = true;
      
      // Set weight and time scale
      action.setEffectiveWeight(1.0);
      action.setEffectiveTimeScale(1.0);
      
      // Play the action
      action.play();
      
      console.log(`Started animation: ${animationName}`);
    } catch (error) {
      console.error(`Error starting animation ${animationName}:`, error);
    }
  };

  useEffect(() => {
    if (!mountRef.current) return;
    
    let animationFrameId;
    let mounted = true;
    const currentMount = mountRef.current;

    console.log("Initializing 3D scene...");

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Add background image if provided
    if (backgroundImageUrl) {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        backgroundImageUrl,
        (texture) => {
          scene.background = texture;
          console.log('Background image loaded successfully');
        },
        (progress) => {
          console.log('Background loading progress:', progress);
        },
        (error) => {
          console.error('Error loading background image:', error);
          // Fallback to gradient background
          scene.background = new THREE.Color(0x000000);
        }
      );
    } else {
      // Default background color
      scene.background = new THREE.Color(0x000000);
    }

    const camera = new THREE.PerspectiveCamera(
      45,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: false, // Never use alpha so background is always fully visible
      preserveDrawingBuffer: true
    });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    currentMount.appendChild(renderer.domElement);

    // Enhanced lighting for better material visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Add a second light from the opposite direction
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight2.position.set(-5, 5, -5);
    scene.add(directionalLight2);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controlsRef.current = controls;

    // Start the clock
    clockRef.current.start();

    console.log("Loading 3D model:", modelUrl);

    // Model loading
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (!mounted) return;
        
        console.log("Model loaded successfully!");
        const model = gltf.scene;
        modelRef.current = model;

        // Setup materials
        let materialCount = 0;
        let textureCount = 0;
        
        model.traverse((child) => {
          if (child.isMesh) {
            console.log(`Mesh: ${child.name || 'unnamed'}`);
            
            // Handle both single materials and material arrays
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            
            materials.forEach((mat, index) => {
              if (mat) {
                materialCount++;
                console.log(`  Material ${index}: ${mat.type}`);
                
                // Ensure the material supports skinning if needed
                if (child.skeleton && mat.skinning !== undefined) {
                  mat.skinning = true;
                }
                
                // Force material update
                mat.needsUpdate = true;
              }
            });
            
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = true;
          }
        });
        
        console.log(`Total materials: ${materialCount}, Total textures: ${textureCount}`);

        // Position and scale the model
        const modelInfo = normalizeModel(model);
        adjustCameraForModel(camera, controls, modelInfo);
        scene.add(model);

        // Animation setup
        if (gltf.animations && gltf.animations.length > 0) {
          console.log(`Found ${gltf.animations.length} animations:`);
          
          // Create mixer
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;
          
          // Initialize animation categories
          animationsRef.current = {
            idle: [],
            talk: [],
            thinking: []
          };
          
          // Process all animations
          gltf.animations.forEach((clip, index) => {
            console.log(`Animation ${index}: "${clip.name}" (duration: ${clip.duration}s)`);
            
            const action = mixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat);
            
            // Store by name and index for reference
            animationsRef.current[`clip_${index}`] = action;
            if (clip.name) {
              animationsRef.current[clip.name] = action;
            }
            
            // Categorize animations based on their names
            const lowerName = clip.name.toLowerCase();
            
            // Identify idle animations (idle1, idle2, idle3)
            if (lowerName.includes('idle')) {
              animationsRef.current.idle.push(action);
              console.log(`Added "${clip.name}" as idle animation`);
            }
            
            // Identify talk animations (talking1, talking2, talking3)
            else if (lowerName.includes('talk')) {
              animationsRef.current.talk.push(action);
              console.log(`Added "${clip.name}" as talk animation`);
            }
            
            // Identify thinking animations (thinking1, thinking2)
            else if (lowerName.includes('think')) {
              animationsRef.current.thinking.push(action);
              console.log(`Added "${clip.name}" as thinking animation`);
            }
            
            // If we couldn't categorize it, try to infer from index
            else if (index >= 0 && index < 3) {
              animationsRef.current.idle.push(action);
              console.log(`Added animation ${index} as idle animation (by index)`);
            }
            else if (index >= 3 && index < 6) {
              animationsRef.current.talk.push(action);
              console.log(`Added animation ${index} as talk animation (by index)`);
            }
            else if (index >= 6) {
              animationsRef.current.thinking.push(action);
              console.log(`Added animation ${index} as thinking animation (by index)`);
            }
          });

          // Ensure we have animations for all categories with fallbacks
          console.log("Animation categories:", {
            idle: animationsRef.current.idle.length,
            talk: animationsRef.current.talk.length,
            thinking: animationsRef.current.thinking.length
          });
          
          if (animationsRef.current.idle.length === 0 && gltf.animations.length > 0) {
            console.log('No idle animations found, using first animation as fallback');
            animationsRef.current.idle.push(mixer.clipAction(gltf.animations[0]));
          }
          
          if (animationsRef.current.talk.length === 0 && gltf.animations.length > 1) {
            console.log('No talk animations found, using fallback');
            animationsRef.current.talk.push(mixer.clipAction(gltf.animations[1]));
          } else if (animationsRef.current.talk.length === 0) {
            animationsRef.current.talk = [...animationsRef.current.idle];
          }
          
          if (animationsRef.current.thinking.length === 0 && gltf.animations.length > 2) {
            console.log('No thinking animations found, using fallback');
            animationsRef.current.thinking.push(mixer.clipAction(gltf.animations[2]));
          } else if (animationsRef.current.thinking.length === 0) {
            animationsRef.current.thinking = [...animationsRef.current.idle];
          }

          // Force an initial update of the mixer
          mixer.update(0);

          // Start a random idle animation after a brief delay
          setTimeout(() => {
            if (mounted) {
              const randomIdle = getRandomAnimation('idle');
              if (randomIdle) {
                startAnimation(randomIdle.action, `idle[${randomIdle.index}]`);
                currentActionRef.current = randomIdle.action;
                setModelLoaded(true);
              } else {
                console.error("Failed to get random idle animation");
                setModelLoaded(true); // Still set model as loaded to avoid infinite loading
              }
            }
          }, 100);
          
        } else {
          console.warn('No animations found in the model');
          setModelLoaded(true);
        }
      },
      (xhr) => {
        if (mounted) {
          const progress = (xhr.loaded / xhr.total) * 100;
          setLoadingProgress(progress);
          console.log(`Loading progress: ${progress.toFixed(2)}%`);
        }
      },
      (error) => {
        if (mounted) {
          const errorMsg = `Failed to load model: ${error.message}`;
          console.error(errorMsg);
          setError(errorMsg);
        }
      }
    );

    // Animation loop
    const animate = () => {
      if (!mounted) return;
      
      animationFrameId = requestAnimationFrame(animate);
      
      // Get delta time
      const delta = clockRef.current.getDelta();
      
      // Update animations
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      } else if (modelRef.current) {
        // Fallback rotation if no animations
        modelRef.current.rotation.y += 0.01;
      }
      
      // Update controls
      if (controls) {
        controls.update();
      }
      
      // Render
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      if (!camera || !renderer || !currentMount) return;
      
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      mounted = false;
      console.log("Cleaning up 3D scene");
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (currentMount && renderer) {
        currentMount.removeChild(renderer.domElement);
      }
      if (renderer) {
        renderer.dispose();
      }
    };
  }, [modelUrl, backgroundImageUrl]);

  // Handle animation switching based on state (idle, thinking, or talking)
  useEffect(() => {
    if (!modelLoaded || !mixerRef.current) {
      return;
    }

    try {
      // Determine which animation category to use based on current state
      let targetAnimationCategory = 'idle';
      if (isThinking) {
        targetAnimationCategory = 'thinking';
      } else if (isPlayingAudio) {
        targetAnimationCategory = 'talk';
      }
      
      console.log(`Animation state changed: ${targetAnimationCategory} (thinking: ${isThinking}, audio: ${isPlayingAudio})`);
      
      // Get a random animation from the selected category
      const randomAnimation = getRandomAnimation(targetAnimationCategory);
      
      if (!randomAnimation) {
        console.warn(`No ${targetAnimationCategory} animations available`);
        return;
      }

      const targetAction = randomAnimation.action;
      
      if (targetAction !== currentActionRef.current) {
        console.log(`Switching to ${targetAnimationCategory}[${randomAnimation.index}] animation`);
        
        // Stop current animation with a crossfade
        if (currentActionRef.current) {
          currentActionRef.current.fadeOut(0.5);
        }
        
        // Start new animation with a crossfade
        targetAction.reset();
        targetAction.fadeIn(0.5);
        targetAction.play();
        
        currentActionRef.current = targetAction;
      }
    } catch (error) {
      console.error("Error switching animations:", error);
    }
  }, [isPlayingAudio, isThinking, modelLoaded]);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mountRef} 
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      
      {!modelLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-center">
            <div className="text-[#ff5e00] text-lg mb-2">Loading model...</div>
            <div className="w-48 bg-gray-700 rounded-full h-2">
              <div 
                className="bg-[#ff5e00] h-2 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="text-[#ff5e00] text-sm mt-2">{Math.round(loadingProgress)}%</div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-[#ff5e00] text-center">
            <div className="text-lg mb-2">{error}</div>
            <div className="text-sm">Model path: {modelUrl}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rick3DViewer;
