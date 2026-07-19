// Draws the emulator's #canvas as a flat "cinema screen" quad in the XR scene
// (KROK 3). Hand-rolled GL - a textured quad is not worth a three.js dependency.
//
// The texture is uploaded with texImage2D(#canvas) - legal for a WebGL canvas
// source, but ONLY reliable in the same JS task in which RetroArch drew (the
// drawing buffer may be gone after compositing; preserveDrawingBuffer is off).
// XrSessionManager guarantees that by uploading right after a flush that ran
// page callbacks. XR frames without a fresh emulator draw reuse the texture.
export class XrScreenRenderer {
    #gl;
    #program;
    #quad;
    #texture;
    #aPos; #aUv; #uMvp;
    #hasFrame = false;

    constructor(gl) {
        this.#gl = gl;
        this.#program = this.#createProgram(
            `attribute vec2 aPos;
             attribute vec2 aUv;
             uniform mat4 uMvp;
             varying vec2 vUv;
             void main() {
                 vUv = aUv;
                 gl_Position = uMvp * vec4(aPos, 0.0, 1.0);
             }`,
            `precision mediump float;
             varying vec2 vUv;
             uniform sampler2D uTex;
             void main() {
                 gl_FragColor = texture2D(uTex, vUv);
             }`
        );
        this.#aPos = gl.getAttribLocation(this.#program, 'aPos');
        this.#aUv = gl.getAttribLocation(this.#program, 'aUv');
        this.#uMvp = gl.getUniformLocation(this.#program, 'uMvp');

        // Unit quad centered on origin, interleaved x,y,u,v (triangle strip).
        // v=0 at the bottom - uploads use UNPACK_FLIP_Y_WEBGL.
        this.#quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -0.5, -0.5, 0, 0,
            0.5, -0.5, 1, 0,
            -0.5, 0.5, 0, 1,
            0.5, 0.5, 1, 1
        ]), gl.STATIC_DRAW);

        // NPOT canvas texture -> clamp + linear, no mipmaps (WebGL1-safe).
        this.#texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.#texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }

    #createProgram(vsSource, fsSource) {
        const gl = this.#gl;
        const compile = (type, source) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                throw new Error('[xr] shader compile failed: ' + gl.getShaderInfoLog(shader));
            }
            return shader;
        };
        const program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, vsSource));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fsSource));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('[xr] program link failed: ' + gl.getProgramInfoLog(program));
        }
        return program;
    }

    uploadFromCanvas(canvas) {
        const gl = this.#gl;
        gl.bindTexture(gl.TEXTURE_2D, this.#texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        this.#hasFrame = true;
    }

    /**
     * Draws the screen for every view of the pose. No-op until the first upload.
     * Placement in 'local' space (y=0 = eye level at session start): `height`
     * meters tall, centered `distance` meters ahead - owned by XrSessionManager.
     * headLocked=true skips the view matrix: the screen rides with the headset.
     */
    render(layer, pose, aspect, height = 1.5, distance = 2.0, headLocked = false) {
        if (!this.#hasFrame) return;
        const gl = this.#gl;

        const width = height * (aspect > 0 ? aspect : 4 / 3);
        // Column-major scale+translate: screen centered at eye level, `distance` ahead.
        const model = new Float32Array([
            width, 0, 0, 0,
            0, height, 0, 0,
            0, 0, 1, 0,
            0, 0, -distance, 1
        ]);

        gl.useProgram(this.#program);
        // Write REAL depth values: Quest's positional reprojection uses the
        // submitted depth buffer - without it the quad is treated as infinitely
        // far and DRIFTS/swims when the head moves (system windows are stable
        // because they're compositor layers). ALWAYS = no occlusion, depth
        // writes only (writes happen solely while DEPTH_TEST is enabled).
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.ALWAYS);
        gl.disable(gl.CULL_FACE);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.#quad);
        gl.enableVertexAttribArray(this.#aPos);
        gl.vertexAttribPointer(this.#aPos, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(this.#aUv);
        gl.vertexAttribPointer(this.#aUv, 2, gl.FLOAT, false, 16, 8);
        gl.bindTexture(gl.TEXTURE_2D, this.#texture);

        for (const view of pose.views) {
            const vp = layer.getViewport(view);
            if (!vp || vp.width === 0) continue;
            gl.viewport(vp.x, vp.y, vp.width, vp.height);
            const mvp = headLocked
                ? mat4mul(view.projectionMatrix, model)
                : mat4mul(mat4mul(view.projectionMatrix, view.transform.inverse.matrix), model);
            gl.uniformMatrix4fv(this.#uMvp, false, mvp);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
    }
}

/** Column-major 4x4 multiply (a*b), as used by WebXR's Float32Array matrices. */
function mat4mul(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            out[col * 4 + row] =
                a[row] * b[col * 4] +
                a[4 + row] * b[col * 4 + 1] +
                a[8 + row] * b[col * 4 + 2] +
                a[12 + row] * b[col * 4 + 3];
        }
    }
    return out;
}
