/* A small, dependency-free GLB loader for the classic (non-module) three.js build this game
 * already uses. Three.js's own GLTFLoader is ES-module-only from r150+; importing it would mean
 * a second, separate instance of the THREE classes living alongside the classic <script> one this
 * whole engine is built on, and mixing objects between two module instances of THREE risks subtle
 * bugs. Rather than restructure the working engine to modules, this reads the parts of glTF/GLB
 * that Captain Sean's export actually uses: node hierarchy, POSITION/NORMAL/indices, and flat PBR
 * colors (no images, no skinning weights, no animations) — built directly with window.THREE.
 *
 * Not a general glTF loader: no textures, no skin deformation, no animation import. If a future
 * export adds any of those, this needs extending (or the ESM GLTFLoader needs a real bridge).
 */
(function () {
  "use strict";
  const T = window.THREE;
  if (!T) return;

  const COMPONENT_CTORS = {
    5120: Int8Array, 5121: Uint8Array, 5122: Int16Array,
    5123: Uint16Array, 5124: Int32Array, 5125: Uint32Array, 5126: Float32Array
  };
  const TYPE_SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

  function parseGLB(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("Not a GLB file (bad magic)");
    let offset = 12, json = null, bin = null;
    while (offset < buf.byteLength) {
      const chunkLen = dv.getUint32(offset, true), chunkType = dv.getUint32(offset + 4, true);
      const data = buf.slice(offset + 8, offset + 8 + chunkLen);
      if (chunkType === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(data));
      else if (chunkType === 0x004e4942) bin = data;
      offset += 8 + chunkLen;
    }
    if (!json) throw new Error("GLB has no JSON chunk");
    return { json, bin };
  }

  // Read one accessor into a flat typed array (only supports the non-interleaved, non-sparse
  // case this export uses).
  function readAccessor(json, bin, index) {
    const acc = json.accessors[index];
    const view = json.bufferViews[acc.bufferView];
    const Ctor = COMPONENT_CTORS[acc.componentType];
    const size = TYPE_SIZES[acc.type];
    const byteOffset = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const stride = view.byteStride;
    if (!stride || stride === size * Ctor.BYTES_PER_ELEMENT) {
      return new Ctor(bin, byteOffset, acc.count * size);
    }
    // Interleaved: copy element-by-element.
    const out = new Ctor(acc.count * size);
    for (let i = 0; i < acc.count; i++) {
      const src = new Ctor(bin, byteOffset + i * stride, size);
      out.set(src, i * size);
    }
    return out;
  }

  function buildMaterial(cache, json, materialIndex) {
    if (materialIndex === undefined) return new T.MeshStandardMaterial({ color: 0x888888 });
    if (cache[materialIndex]) return cache[materialIndex];
    const m = json.materials[materialIndex] || {};
    const pbr = m.pbrMetallicRoughness || {};
    const [r, g, b, a] = pbr.baseColorFactor || [1, 1, 1, 1];
    const mat = new T.MeshStandardMaterial({
      color: new T.Color(r, g, b),
      metalness: pbr.metallicFactor !== undefined ? pbr.metallicFactor : 1,
      roughness: pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 1,
      opacity: a, transparent: a < 1,
      side: m.doubleSided ? T.DoubleSide : T.FrontSide,
      name: m.name || ""
    });
    cache[materialIndex] = mat;
    return mat;
  }

  function buildMesh(json, bin, matCache, meshIndex) {
    const meshDef = json.meshes[meshIndex];
    const group = new T.Group();
    for (const prim of meshDef.primitives) {
      const geo = new T.BufferGeometry();
      const posIdx = prim.attributes.POSITION;
      if (posIdx === undefined) continue;
      geo.setAttribute("position", new T.BufferAttribute(readAccessor(json, bin, posIdx), 3));
      if (prim.attributes.NORMAL !== undefined) geo.setAttribute("normal", new T.BufferAttribute(readAccessor(json, bin, prim.attributes.NORMAL), 3));
      if (prim.attributes.TEXCOORD_0 !== undefined) geo.setAttribute("uv", new T.BufferAttribute(readAccessor(json, bin, prim.attributes.TEXCOORD_0), 2));
      if (prim.indices !== undefined) geo.setIndex(new T.BufferAttribute(readAccessor(json, bin, prim.indices), 1));
      if (!prim.attributes.NORMAL) geo.computeVertexNormals();
      const mesh = new T.Mesh(geo, buildMaterial(matCache, json, prim.material));
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    }
    // A mesh with exactly one primitive is the common case here; return the mesh itself so
    // callers see a plain Mesh rather than a redundant wrapper Group.
    if (group.children.length === 1) return group.children[0];
    return group;
  }

  // Build the node tree, returning { root, nodesByIndex, bonesByName } where bonesByName covers
  // every node referenced by the (single) skin's joints list, keyed by its glTF name — the same
  // names Blender exported (e.g. "upper_arm.R"), for future pose-driving code to look up.
  function buildScene(json, bin) {
    const matCache = {};
    const jointNames = new Set((json.skins && json.skins[0] && json.skins[0].joints) || []);
    const nodesByIndex = new Array(json.nodes.length);
    const bonesByName = {};

    function buildNode(i) {
      if (nodesByIndex[i]) return nodesByIndex[i];
      const def = json.nodes[i];
      let obj;
      if (def.mesh !== undefined) {
        obj = buildMesh(json, bin, matCache, def.mesh);
        if (!(obj instanceof T.Group)) {
          // Wrap so the node's own transform has a place to live independent of the mesh's
          // local geometry origin, and so it can still carry named children if any.
          const wrap = new T.Group();
          wrap.add(obj);
          obj = wrap;
        }
      } else {
        obj = new T.Group();
      }
      obj.name = def.name || ("node_" + i);
      if (def.translation) obj.position.fromArray(def.translation);
      if (def.rotation) obj.quaternion.fromArray(def.rotation);
      if (def.scale) obj.scale.fromArray(def.scale);
      if (def.matrix) obj.matrix.fromArray(def.matrix).decompose(obj.position, obj.quaternion, obj.scale);
      nodesByIndex[i] = obj;
      if (jointNames.has(i)) bonesByName[def.name] = obj;
      (def.children || []).forEach(ci => obj.add(buildNode(ci)));
      return obj;
    }

    const root = new T.Group();
    (json.scenes[json.scene || 0].nodes || []).forEach(i => root.add(buildNode(i)));
    return { root, nodesByIndex, bonesByName };
  }

  function load(url) {
    return fetch(url).then(r => {
      if (!r.ok) throw new Error("GLB fetch failed: " + r.status + " " + url);
      return r.arrayBuffer();
    }).then(buf => {
      const { json, bin } = parseGLB(buf);
      const { root, bonesByName } = buildScene(json, bin);
      return { scene: root, bones: bonesByName, materialCount: (json.materials || []).length, meshCount: (json.meshes || []).length, animations: json.animations || [] };
    });
  }

  window.GLBLoad = { load };
})();
