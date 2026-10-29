// Visuals adapted from the approved VM/E Hybrid prototype (Three.js r170).
import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

export async function createSplashRenderer({ host, signal, onFrame }) {
    const INTRO_DURATION = 6000;
    const DURATION = 6000;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion ? 1200 : DURATION;
    const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
    const mix = (a, b, t) => a + (b - a) * t;
    const ease = (t, a, b) => { const v = clamp((t - a) / (b - a)); return v*v*v*(v*(v*6-15)+10); };
    let renderer, scene, environment, floor, composer;
    let position = 0, raf = 0, elapsed = 0, startedAt = 0;
    let complete, fail, disposed = false, finished = false;

    const finishPlayback = error => {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(raf);
        if (error) fail?.(error); else complete?.();
    };
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        finishPlayback();
        const geometries = new Set(), materials = new Set();
        scene?.traverse(object => {
            if (object.geometry) geometries.add(object.geometry);
            if (object.material) {
                const list = Array.isArray(object.material) ? object.material : [object.material];
                list.forEach(material => materials.add(material));
            }
        });
        geometries.forEach(geometry => geometry.dispose());
        materials.delete(floor?.material);
        materials.forEach(material => material.dispose());
        floor?.dispose();
        composer?.passes.forEach(pass => pass.dispose());
        composer?.dispose();
        environment?.dispose();
        renderer?.dispose();
        renderer?.forceContextLoss();
        renderer?.domElement.remove();
    };
    try {
    renderer = new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio,1.5),2));
    renderer.setClearColor(0x000000);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label','VM/E — animacja przestrzennych liter');
    renderer.domElement.setAttribute('role','img');
    host.append(renderer.domElement);
    RectAreaLightUniformsLib.init();
    scene = new T.Scene();
    scene.background = new T.Color(0x000000);
    const camera = new T.PerspectiveCamera(35, innerWidth/innerHeight,.08,600);
    camera.position.set(3,1.1,26);
    const target = new T.Vector3();

    // A photographic studio built as emissive surfaces, baked into an HDR reflection map.
    const studio = new T.Scene();
    studio.background = new T.Color(0x010203);
    const panel = (w,h,color,energy,pos,aim=[0,0,0]) => {
      const mesh = new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(energy),side:T.DoubleSide}));
      mesh.position.fromArray(pos);mesh.lookAt(...aim);studio.add(mesh);return mesh;
    };
    panel(22,1.7,0xd7faff,11,[0,8,7]);
    panel(1.7,15,0x9dffef,8,[-12,3,4]);
    panel(2,14,0x8ed9ff,12,[13,2,6]);
    panel(24,.8,0xa2f5ff,9,[0,6,-5]);
    panel(12,7,0x174e66,.7,[2,-5,10]);
    panel(8,10,0xe4ffff,3,[-9,4,13]);
    const pmrem = new T.PMREMGenerator(renderer);
    environment = pmrem.fromScene(studio,.025,.1,100);
    scene.environment = environment.texture;
    pmrem.dispose();
    studio.traverse(object=>{if(object.isMesh){object.geometry.dispose();object.material.dispose();}});

    const logo = new T.Group();scene.add(logo);
    // Broad softbox illumination is evaluated on the real surfaces in object space.
    // The light fades across much of the letter height, without a hard cut or stripe.
    const beam = {
      uBeamHeight:{value:-6.615},
      uBeamSlope:{value:.27},
      uBeamPower:{value:0}
    };
    // Narrow moving studio reflections, restricted to the front bevels.
    const edgeSweep={
      uEdgeSweep:{value:0},uEdgeStrength:{value:0},
      uEdgeLightA:{value:new T.Vector3()},uEdgeLightB:{value:new T.Vector3()}
    };
    const beamDeclarations = `
      varying vec3 vLogoLocal;
      uniform float uBeamHeight;
      uniform float uBeamSlope;
      uniform float uBeamPower;
    `;
    const attachCoordinates = shader => {
      Object.assign(shader.uniforms,beam);
      shader.vertexShader='varying vec3 vLogoLocal;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvLogoLocal = transformed;'
      );
      shader.fragmentShader=beamDeclarations+shader.fragmentShader;
    };
    const front = new T.MeshPhysicalMaterial({color:0xffffff,metalness:.68,roughness:.20,clearcoat:1,clearcoatRoughness:.085,ior:1.65,envMapIntensity:1.4});
    front.onBeforeCompile = shader => {
      attachCoordinates(shader);
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float horizontal = clamp((vLogoLocal.x + 10.5) / 21.0,0.0,1.0);
        vec3 enamel = mix(vec3(0.015,0.39,0.30),vec3(0.009,0.20,0.40),horizontal);
        diffuseColor.rgb *= enamel;
      `).replace('#include <opaque_fragment>',`
        float beamDistance = uBeamHeight + .107692 + uBeamSlope*vLogoLocal.x - vLogoLocal.y;
        float lit = smoothstep(-2.8,2.8,beamDistance);
        float reflectionDistance = (beamDistance-.55)/2.4;
        float softReflection = exp(-reflectionDistance*reflectionDistance);
        vec3 cyan = mix(vec3(.025,.73,.56),vec3(.012,.36,.72),horizontal);
        vec3 coolWhite = vec3(.72,1.70,1.85);
        vec3 shadow = outgoingLight*.050 + enamel*.018;
        vec3 coating = mix(vec3(.38,1.0,.88),vec3(.30,.80,1.0),horizontal);
        vec3 illuminated = outgoingLight*coating*.24 + cyan*.18;
        outgoingLight = mix(shadow,illuminated,lit*uBeamPower);
        outgoingLight += uBeamPower*lit*softReflection*(cyan*.20 + coolWhite*.020);
        #include <opaque_fragment>
      `);
    };
    front.customProgramCacheKey=()=> 'vme-softbox-enamel-4';
    const edge = new T.MeshPhysicalMaterial({color:0x167684,metalness:.94,roughness:.16,clearcoat:1,clearcoatRoughness:.07,envMapIntensity:2});
    edge.onBeforeCompile = shader => {
      attachCoordinates(shader);
      Object.assign(shader.uniforms,edgeSweep);
      shader.fragmentShader=`uniform float uEdgeSweep;
        uniform float uEdgeStrength;
        uniform vec3 uEdgeLightA;
        uniform vec3 uEdgeLightB;
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        float beamDistance = uBeamHeight + .107692 + uBeamSlope*vLogoLocal.x - vLogoLocal.y;
        float lit = smoothstep(-2.8,2.8,beamDistance)*uBeamPower;
        float reflectionDistance = (beamDistance-.55)/2.4;
        float softReflection = exp(-reflectionDistance*reflectionDistance)*uBeamPower;
        outgoingLight *= mix(.20,.68,lit);
        outgoingLight += vec3(.02,.45,.52)*softReflection*.075;

        // Reflections use the real bevel normal and GGX / clearcoat response.
        // Transform each source for the current view, including the floor reflection.
        vec3 viewDirection=normalize(vViewPosition);
        vec3 toLightA=(viewMatrix*vec4(uEdgeLightA,1.0)).xyz+vViewPosition;
        vec3 toLightB=(viewMatrix*vec4(uEdgeLightB,1.0)).xyz+vViewPosition;
        float distanceA=length(toLightA),distanceB=length(toLightB);
        vec3 lightA=toLightA/max(distanceA,.001),lightB=toLightB/max(distanceB,.001);
        vec3 specularA=BRDF_GGX(lightA,viewDirection,normal,material)
          +BRDF_GGX_Clearcoat(lightA,viewDirection,clearcoatNormal,material)*material.clearcoat;
        vec3 specularB=BRDF_GGX(lightB,viewDirection,normal,material)
          +BRDF_GGX_Clearcoat(lightB,viewDirection,clearcoatNormal,material)*material.clearcoat;
        float center=mix(-13.0,13.0,uEdgeSweep);
        float coordinate=vLogoLocal.x+.28*vLogoLocal.y;
        // Squaring signed offsets must use multiplication: GLSL pow(x, 2) is
        // undefined for negative x and can turn the entire bloom chain black.
        float offsetA=(coordinate-center)/1.75;
        float offsetB=(coordinate-center+2.0)/2.15;
        float bandA=exp(-offsetA*offsetA);
        float bandB=exp(-offsetB*offsetB);
        float frontBevel=smoothstep(.31,.46,vLogoLocal.z);
        float energyA=max(dot(normal,lightA),0.0)/(1.0+.05*distanceA*distanceA);
        float energyB=max(dot(normal,lightB),0.0)/(1.0+.05*distanceB*distanceB);
        outgoingLight+=uEdgeStrength*frontBevel*(
          specularA*vec3(.80,1.0,1.0)*energyA*bandA*25.0
          +specularB*vec3(.25,.70,1.0)*energyB*bandB*14.0
        );
        #include <opaque_fragment>
      `);
    };
    edge.customProgramCacheKey=()=> 'vme-softbox-bevel-light-sweep-7';
    const back = new T.MeshPhysicalMaterial({color:0x04252d,metalness:.9,roughness:.22,envMapIntensity:1.2});
    const outlinePoints = [
      [[130,190],[234,190],[304,459],[375,190],[479,190],[356,578],[251,578]],
      [[514,190],[620,190],[708,410],[796,190],[902,190],[902,578],[813,578],[813,346],[742,523],[674,523],[603,346],[603,578],[514,578]],
      [[939,578],[1056,190],[1131,190],[1014,578]],
      [[1168,190],[1467,190],[1467,272],[1262,272],[1262,340],[1440,340],[1440,419],[1262,419],[1262,496],[1467,496],[1467,578],[1168,578]]
    ];
    const letters = [];
    for (const points of outlinePoints) {
      const shape = new T.Shape();
      points.forEach(([x,y],i)=>shape[i?'lineTo':'moveTo']((x-800)/65,(384-y)/65));
      shape.closePath();
      const geometry = new T.ExtrudeGeometry(shape,{depth:.80,bevelEnabled:true,bevelThickness:.10,bevelSize:.10,bevelSegments:8,curveSegments:12,steps:1});
      geometry.translate(0,0,-.40);
      const letter = new T.Mesh(geometry,[front,edge]);
      logo.add(letter);letters.push(letter);
      const backingGeometry = new T.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelThickness:.035,bevelSize:.095,bevelSegments:4,steps:1});
      backingGeometry.translate(0,0,-.59);
      logo.add(new T.Mesh(backingGeometry,back));
    }
    logo.rotation.y=-.10;

    // Real area lights create broad reflections that sweep over the beveled edges.
    const key = new T.RectAreaLight(0xe4fcff,18,19,1.1);
    key.position.set(0,3,7);key.lookAt(0,0,0);scene.add(key);
    const left = new T.RectAreaLight(0x33ffe6,18,1,9);
    left.position.set(-11,1,3);left.lookAt(0,0,0);scene.add(left);
    const right = new T.RectAreaLight(0x35baff,25,1,9);
    right.position.set(12,2,4);right.lookAt(0,0,0);scene.add(right);
    const top = new T.DirectionalLight(0x84efff,1.6);
    top.position.set(-2,7,-3);scene.add(top);
    const glint = new T.PointLight(0xcafffa,65,20,2);
    glint.position.set(-7,2,1.6);scene.add(glint);

    // Smoked-glass floor: sharp contact, softer and dimmer farther from the letters.
    floor = new Reflector(new T.PlaneGeometry(70,70),{textureWidth:1536,textureHeight:1024,color:new T.Color(.5,.5,.5),clipBias:.003,multisample:4});
    floor.rotation.x=-Math.PI/2;floor.position.y=-3.10;
    const floorMaterial=floor.material;
    floorMaterial.uniforms.uStrength={value:0};
    floorMaterial.vertexShader='varying vec3 vFloorLocal;\n'+floorMaterial.vertexShader.replace('vUv = textureMatrix * vec4( position, 1.0 );','vFloorLocal = position;\nvUv = textureMatrix * vec4( position, 1.0 );');
    floorMaterial.fragmentShader='varying vec3 vFloorLocal;\nuniform float uStrength;\n'+floorMaterial.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );',`vec2 uv = vUv.xy / vUv.w;
      float spread=1.0+min(abs(vFloorLocal.y)*.30,7.0);
      vec2 texel=vec2(spread/3072.0,spread/2048.0);
      vec4 base=vec4(0.0);
      for(int x=-2;x<=2;x++){
        for(int y=-2;y<=2;y++){
          vec2 offset=vec2(float(x),float(y));
          base+=texture2D(tDiffuse,uv+offset*texel)*exp(-.5*dot(offset,offset));
        }
      }
      base/=6.168924;`).replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );','gl_FragColor = vec4(blendOverlay(base.rgb,color)*uStrength*exp(-abs(vFloorLocal.y)*.17),1.0);');
    scene.add(floor);

    const renderTarget = new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:4});
    composer = new EffectComposer(renderer,renderTarget);
    composer.addPass(new RenderPass(scene,camera));
    const bloom = new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.30,.45,.85);
    composer.addPass(bloom);
    // Small optical rays around the bright reflected highlights, before tone mapping.
    const edgeRays=new ShaderPass({
      uniforms:{tDiffuse:{value:null},uStrength:{value:0},uTexel:{value:new T.Vector2(1,1)}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`uniform sampler2D tDiffuse;uniform float uStrength;uniform vec2 uTexel;varying vec2 vUv;
        vec3 highlight(vec2 uv){vec3 c=texture2D(tDiffuse,uv).rgb;float peak=max(max(c.r,c.g),c.b);return c*smoothstep(1.25,2.5,peak);}
        void main(){vec4 base=texture2D(tDiffuse,vUv);vec3 rays=vec3(0.0);
          if(uStrength>0.0){
            for(int i=1;i<=8;i++){
              float distance=float(i)*1.5;float weight=exp(-float(i)*.45);
              vec2 x=vec2(uTexel.x*distance,0.0),y=vec2(0.0,uTexel.y*distance);
              rays+=(highlight(vUv+x)+highlight(vUv-x))*weight*.065;
              rays+=(highlight(vUv+y)+highlight(vUv-y))*weight*.045;
            }
          }
          gl_FragColor=vec4(base.rgb+rays*uStrength,base.a);
        }`
    });
    composer.addPass(edgeRays);
    composer.addPass(new OutputPass());
    const finish = new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec2 p=(vUv-.5)*vec2(1.0,.85);float vignette=1.0-.36*smoothstep(.12,.65,length(p));gl_FragColor=vec4(c*vignette,1.0);}`});
    composer.addPass(finish);

    let aspect=innerWidth/innerHeight;
    // One continuous orbit/dolly, defined relative to the faces of the letters.
    // Its initial pose matches the original shot; its endpoint is exactly frontal.
    const initialOffset=new T.Vector3(-7.2,1.45,4.8).sub(new T.Vector3(-6.5,.5,.25));
    const initialDistance=initialOffset.length();
    const initialLogoRotation=new T.Quaternion().setFromEuler(new T.Euler(.055,.20,0));
    const initialDirection=initialOffset.clone().normalize().applyQuaternion(initialLogoRotation.clone().invert());
    const initialOrbit=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),initialDirection);
    const frontalOrbit=new T.Quaternion();
    const currentOrbit=new T.Quaternion();
    const cameraOffset=new T.Vector3();
    let cameraProgress=0;
    const configure = ms => {
      position=clamp(ms,0,DURATION);
      const pull=ease(position,700,5100);
      const light=ease(position,350,3300);
      const settle=ease(position,3300,INTRO_DURATION);
      // Keep the first 900 ms, then continue with matching speed and acceleration.
      const sweepTime=Math.max(0,(position-3900)/1000);
      edgeSweep.uEdgeSweep.value=position<=3900
        ? ease(position,3000,6000)
        : clamp(.16308+.441*sweepTime+.28*sweepTime*sweepTime);
      edgeSweep.uEdgeStrength.value=ease(position,3000,3250)*(1-ease(position,5000,5250));
      beam.uBeamHeight.value=mix(-6.615,0,ease(position,1100,5100));
      beam.uBeamSlope.value=mix(.27,.185,ease(position,1200,5400));
      beam.uBeamPower.value=ease(position,900,3000);
      const wide=Math.max(1,1.55/aspect);
      logo.rotation.y=mix(.20,-.10,pull);
      logo.rotation.x=mix(.055,0,pull);
      const sweepCenter=mix(-13,13,edgeSweep.uEdgeSweep.value);
      edgeSweep.uEdgeLightA.value.set(sweepCenter-.8,4.5,4.0).applyEuler(logo.rotation);
      edgeSweep.uEdgeLightB.value.set(sweepCenter+1.2,-3.6,3.2).applyEuler(logo.rotation);

      cameraProgress=ease(position,700,INTRO_DURATION);
      target.set(mix(-6.5,0,cameraProgress),mix(.5,-.35,cameraProgress),mix(.25,0,cameraProgress));
      const finalDistance=Math.hypot(3.6,1.75,27.0*wide);
      const distance=mix(initialDistance,finalDistance,cameraProgress);
      currentOrbit.copy(initialOrbit).slerp(frontalOrbit,cameraProgress);
      cameraOffset.set(0,0,1).applyQuaternion(currentOrbit).applyEuler(logo.rotation);
      camera.position.copy(target).addScaledVector(cameraOffset,distance);
      camera.lookAt(target);
      camera.rotation.z=mix(-.075,0,cameraProgress);

      front.envMapIntensity=mix(.015,1.30,light);
      edge.envMapIntensity=mix(.04,1.60,light);
      back.envMapIntensity=mix(.03,1.1,light);
      key.intensity=mix(.03,14,light);
      key.position.set(mix(-4,0,ease(position,900,4000)),mix(-3.5,4.3,ease(position,900,4700)),mix(3.2,7,ease(position,900,5000)));
      key.lookAt(0,mix(-2,0,ease(position,900,4700)),0);key.rotateZ(-.18);
      left.intensity=mix(.05,17,ease(position,500,3100));
      right.intensity=mix(.02,24,ease(position,1700,4000));
      top.intensity=mix(.025,1.3,light);
      glint.intensity=Math.sin(clamp((position-250)/2600)*Math.PI)*100;
      glint.position.set(mix(-8,12,ease(position,300,2800)),mix(1.5,3.2,ease(position,300,2800)),1.7);
      floor.visible=position>1500;
      floorMaterial.uniforms.uStrength.value=mix(0,.34,ease(position,1800,4200))*(1-ease(position,5100,5600));

      bloom.strength=.085+Math.sin(clamp((position-1000)/3300)*Math.PI)*.04+edgeSweep.uEdgeStrength.value*.12;
      edgeRays.uniforms.uStrength.value=edgeSweep.uEdgeStrength.value;
      renderer.toneMappingExposure=mix(.30,.60,light)+Math.sin(settle*Math.PI)*.015;
      onFrame(position);
    };

        const draw = () => composer.render();
        const resize = () => {
            aspect = innerWidth / innerHeight;
            renderer.setSize(innerWidth, innerHeight);
            composer.setSize(innerWidth, innerHeight);
            edgeRays.uniforms.uTexel.value.set(1 / (innerWidth * renderer.getPixelRatio()), 1 / (innerHeight * renderer.getPixelRatio()));
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
            configure(position);
            if (reducedMotion && complete) {
                onFrame(elapsed < 900 ? 4000 : 5000 + clamp((elapsed - 900) / 300) * 1000);
            }
            draw();
        };
        resize();
        // Warm the planar-reflection shader before starting the timeline.
        floor.visible = true;
        draw();
        floor.visible = false;
        await renderer.compileAsync(scene, camera);

        const tick = now => {
            try {
            if (finished || signal.aborted) { finishPlayback(); return; }
            elapsed = Math.min(duration, now - startedAt);
            if (reducedMotion) {
                // A still frontal logo, then a short dissolve; no camera or light motion.
                onFrame(elapsed < 900 ? 4000 : 5000 + clamp((elapsed - 900) / 300) * 1000);
            } else {
                configure(elapsed);
                draw();
            }
            if (elapsed < duration) raf = requestAnimationFrame(tick); else finishPlayback();
            } catch (error) {
                finishPlayback(error);
            }
        };
        const visibility = () => {
            if (!complete || finished) return;
            if (document.hidden) {
                elapsed = Math.min(duration, performance.now() - startedAt);
                cancelAnimationFrame(raf);
            } else {
                startedAt = performance.now() - elapsed;
                raf = requestAnimationFrame(tick);
            }
        };
        const play = () => new Promise((resolve, reject) => {
            complete = resolve;
            fail = reject;
            if (signal.aborted || disposed) { resolve(); return; }
            if (reducedMotion) {
                configure(DURATION);
                onFrame(4000);
                draw();
            }
            startedAt = performance.now();
            window.addEventListener('resize', resize, { signal });
            document.addEventListener('visibilitychange', visibility, { signal });
            signal.addEventListener('abort', () => finishPlayback(), { once: true });
            renderer.domElement.addEventListener('webglcontextlost', event => {
                event.preventDefault();
                finishPlayback(new Error('Splash WebGL context lost'));
            }, { signal });
            if (!document.hidden) raf = requestAnimationFrame(tick);
        });
        return { play, dispose };
    } catch (error) {
        dispose();
        throw error;
    }
}
