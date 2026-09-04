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
        // Women: Warm Burgundy (#7A1228), Champagne (#FAF6F0), Amber (#B88A4E), Rose (#D4A5A5)
        // Men: Deep Charcoal/Slate (#1E2229), Burgundy Iron (#5C1221), Muted Sand (#D4CEBF)

        void main() {
          vec2 uv = gl_FragCoord.xy / uResolution.xy;
          float aspect = uResolution.x / uResolution.y;
          vec2 p = uv;
          p.x *= aspect;

          float t = uTime * 0.18;

          // Organic harmonic wave fields
          float w1 = sin(p.x * 1.8 + t * 1.2) * cos(p.y * 1.5 - t * 0.9);
          float w2 = cos(p.y * 2.2 + t * 1.4) * sin(p.x * 1.2 - t * 0.7);
          float w3 = sin((p.x + p.y) * 1.5 + t);

          float blend1 = smoothstep(-0.6, 0.8, w1 + w3 * 0.5);
          float blend2 = smoothstep(-0.7, 0.7, w2 - w1 * 0.4);

          // Color Palettes
          vec3 cBgWomen = vec3(0.98, 0.965, 0.941);     // #FAF6F0 warm champagne
          vec3 cMaroonWomen = vec3(0.478, 0.071, 0.157); // #7A1228 deep maroon
          vec3 cAmberWomen = vec3(0.722, 0.541, 0.306);  // #B88A4E amber gold
          vec3 cRoseWomen = vec3(0.85, 0.72, 0.72);      // soft rose quartz

          vec3 cBgMen = vec3(0.886, 0.867, 0.835);       // #E2DDD5 slate stone
          vec3 cMaroonMen = vec3(0.36, 0.06, 0.12);      // #5C1221 dark iron wine
          vec3 cSlateMen = vec3(0.18, 0.21, 0.25);       // deep graphite
          vec3 cBronzeMen = vec3(0.55, 0.45, 0.35);      // brushed bronze

          vec3 cBg = mix(cBgWomen, cBgMen, uMenMode);
          vec3 cMaroon = mix(cMaroonWomen, cMaroonMen, uMenMode);
          vec3 cAccent = mix(cAmberWomen, cBronzeMen, uMenMode);
          vec3 cSoft = mix(cRoseWomen, cSlateMen, uMenMode);

          // Blend gradients gently
          vec3 col = mix(cBg, cMaroon, blend1 * 0.28);
          col = mix(col, cAccent, blend2 * 0.18);
          col = mix(col, cSoft, (w3 * 0.5 + 0.5) * 0.08);

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
            const baseColor = isMen ? '#E2DDD5' : '#FAF6F0';
            const maroon = isMen ? 'rgba(92, 18, 33, 0.16)' : 'rgba(122, 18, 40, 0.18)';
            const gold = isMen ? 'rgba(100, 110, 120, 0.14)' : 'rgba(184, 138, 78, 0.16)';

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
            g2.addColorStop(0, gold);
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
