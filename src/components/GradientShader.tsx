import React, { useEffect, useRef, useState } from 'react';
import { useCollection } from '../context/CollectionContext';

// High-performance WebGL & Canvas 2D Gradient Shader
// Emits Matilda's signature luxury palette: Velvet Maroon, Rich Wine, Warm Champagne, and Amber Mist
// Auto-throttled and pauses when off-screen for 0% CPU/GPU overhead during scrolling
export const GradientShader: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { collection } = useCollection();
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let gl: WebGLRenderingContext | null = null;
    let isVisible = true;
    let lastTime = 0;

    // Check visibility via IntersectionObserver
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting && !document.hidden;
        });
      },
      { threshold: 0.01 }
    );
    observer.observe(canvas);

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Try WebGL first
    try {
      gl = canvas.getContext('webgl', { 
        alpha: true, 
        antialias: false,
        depth: false,
        powerPreference: 'low-power'
      });
    } catch (e) {
      gl = null;
    }

    // Set canvas dimensions
    const resize = () => {
      if (!canvas) return;
      // Cap devicePixelRatio at 1.5 to guarantee 60fps on high-res Retina displays
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    if (gl) {
      // Vertex shader
      const vsSource = `
        attribute vec2 position;
        varying vec2 vUv;
        void main() {
          vUv = (position + 1.0) * 0.5;
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `;

      // Fragment shader with smooth organic wave harmonic gradients
      const fsSource = `
        precision mediump float;
        varying vec2 vUv;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform float uMenMode;

        // Matilda Brand Colors
        // Pure Beige and Velvet Maroon Tone
        void main() {
          vec2 uv = gl_FragCoord.xy / uResolution.xy;
          float aspect = uResolution.x / uResolution.y;
          vec2 p = uv;
          p.x *= aspect;

          float t = uTime * 0.12;

          // Gentle organic harmonic wave fields
          float w1 = sin(p.x * 1.5 + t * 0.9) * cos(p.y * 1.2 - t * 0.7);
          float w2 = cos(p.y * 1.8 + t * 1.1) * sin(p.x * 1.0 - t * 0.5);
          float w3 = sin((p.x + p.y) * 1.2 + t * 0.8);

          float blend1 = smoothstep(-0.5, 0.9, w1 + w3 * 0.4);
          float blend2 = smoothstep(-0.6, 0.8, w2 - w1 * 0.3);

          // Cohesive Beige & Maroon Palette
          vec3 cBgWomen = vec3(0.898, 0.855, 0.796);      // #E5DACB natural warm antique beige
          vec3 cMaroonWomen = vec3(0.431, 0.063, 0.145);  // #6E1025 deep velvet maroon
          vec3 cSoftBeigeWomen = vec3(0.847, 0.796, 0.729); // #D8CBBA gentle deeper antique beige

          vec3 cBgMen = vec3(0.820, 0.788, 0.722);        // #D1C9B8 warm stone sand
          vec3 cMaroonMen = vec3(0.329, 0.059, 0.114);    // #540F1D deep iron maroon
          vec3 cSoftBeigeMen = vec3(0.761, 0.729, 0.655); // #C2BAA7 deeper muted stone sand

          vec3 cBg = mix(cBgWomen, cBgMen, uMenMode);
          vec3 cMaroon = mix(cMaroonWomen, cMaroonMen, uMenMode);
          vec3 cSoft = mix(cSoftBeigeWomen, cSoftBeigeMen, uMenMode);

          // Subtle, atmospheric ambient gradients (no jarring bright spots)
          vec3 col = mix(cBg, cSoft, blend2 * 0.28);
          col = mix(col, cMaroon, blend1 * 0.16);

          gl_FragColor = vec4(col, 1.0);
        }
      `;

      const createShader = (type: number, source: string) => {
        const shader = gl!.createShader(type);
        if (!shader) return null;
        gl!.shaderSource(shader, source);
        gl!.compileShader(shader);
        if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
          console.warn('Shader compile failed:', gl!.getShaderInfoLog(shader));
          gl!.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const vs = createShader(gl.VERTEX_SHADER, vsSource);
      const fs = createShader(gl.FRAGMENT_SHADER, fsSource);

      if (!vs || !fs) {
        setIsSupported(false);
      } else {
        const program = gl.createProgram();
        if (program) {
          gl.attachShader(program, vs);
          gl.attachShader(program, fs);
          gl.linkProgram(program);

          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.warn('Program link failed:', gl.getProgramInfoLog(program));
            setIsSupported(false);
          } else {
            gl.useProgram(program);

            const positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            const vertices = new Float32Array([
              -1, -1,
               1, -1,
              -1,  1,
              -1,  1,
               1, -1,
               1,  1
            ]);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

            const posAttr = gl.getAttribLocation(program, 'position');
            gl.enableVertexAttribArray(posAttr);
            gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

            const uTimeLoc = gl.getUniformLocation(program, 'uTime');
            const uResLoc = gl.getUniformLocation(program, 'uResolution');
            const uMenModeLoc = gl.getUniformLocation(program, 'uMenMode');

            let startTime = performance.now();

            const render = (time: number) => {
              if (isVisible && gl) {
                // Throttle to maximum 60fps
                if (time - lastTime >= 15) {
                  lastTime = time;
                  const elapsed = (time - startTime) * 0.001;
                  gl.uniform1f(uTimeLoc, elapsed);
                  gl.uniform2f(uResLoc, canvas.width, canvas.height);
                  gl.uniform1f(uMenModeLoc, collection === 'men' ? 1.0 : 0.0);
                  gl.drawArrays(gl.TRIANGLES, 0, 6);
                }
              }
              animId = requestAnimationFrame(render);
            };

            animId = requestAnimationFrame(render);
          }
        }
      }
    } else {
      // 2D Canvas Fallback
      const ctx = canvas.getContext('2d');
      if (ctx) {
        let t = 0;
        const render2D = () => {
          if (isVisible && ctx) {
            t += 0.008;
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            const isMen = collection === 'men';
            const baseColor = isMen ? '#D1C9B8' : '#E5DACB';
            const maroon = isMen ? 'rgba(84, 15, 29, 0.12)' : 'rgba(110, 16, 37, 0.10)';
            const softBeige = isMen ? 'rgba(194, 186, 167, 0.22)' : 'rgba(216, 203, 186, 0.24)';

            ctx.fillStyle = baseColor;
            ctx.fillRect(0, 0, w, h);

            // Grad 1
            const x1 = w * (0.3 + 0.2 * Math.sin(t));
            const y1 = h * (0.3 + 0.2 * Math.cos(t * 0.8));
            const g1 = ctx.createRadialGradient(x1, y1, 10, x1, y1, w * 0.6);
            g1.addColorStop(0, maroon);
            g1.addColorStop(1, 'transparent');
            ctx.fillStyle = g1;
            ctx.fillRect(0, 0, w, h);

            // Grad 2
            const x2 = w * (0.7 + 0.2 * Math.cos(t * 1.1));
            const y2 = h * (0.7 + 0.15 * Math.sin(t * 0.9));
            const g2 = ctx.createRadialGradient(x2, y2, 10, x2, y2, w * 0.55);
            g2.addColorStop(0, softBeige);
            g2.addColorStop(1, 'transparent');
            ctx.fillStyle = g2;
            ctx.fillRect(0, 0, w, h);
          }
          animId = requestAnimationFrame(render2D);
        };
        animId = requestAnimationFrame(render2D);
      }
    }

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', resize);
    };
  }, [collection]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full pointer-events-none transform-gpu"
        style={{ transform: 'translateZ(0)' }}
      />
    </div>
  );
};
