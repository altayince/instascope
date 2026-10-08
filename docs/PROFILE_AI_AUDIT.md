# Public-profile enhancement evaluation — INS-82

## Result and remaining quality gap

The misleading 1080px pipeline and destructive input reduction are fixed. **A production-ready face-restoration model has not been selected.** The product explicitly offers general-purpose AI upscaling and states that face-specific restoration is unavailable. No new model, inference service, paid product or infrastructure is shipped.

For 150px inputs, native 600px output avoids further interpolation but uses the same learned model as before. This is **not evidence that real human faces now look materially better in the product**. Synthetic illustrations look sharper; that cannot establish photographic identity preservation. The separate GFPGAN prototype made one manually aligned face from a real 150px public source visibly sharper on inspection, but invented plausible skin/eye/teeth detail; no high-resolution ground truth or identity metric was available. The source/output stay local and ignored. A trustworthy, noticeably better production restoration for real 150px faces remains unresolved.

## Pipeline audit

Before: validated public CDN photo → canvas shrink to ≤270px → Real-ESRGAN 4× → ordinary canvas resampling to a 1080px long edge. A 150px input became learned 600px then interpolated 1080px; a 320px input lost detail before inference.

After: validated public CDN photo at its native resolution → direct 4× inference or bounded overlapping tiles → core pixels stitched without blending/interpolation → PNG at native learned size. 150px → 600px; 320px → 1280px. Original, progress, cancellation and save remain. SEO route/title/H1, lookup security, parser and archive processing are unchanged.

Production model: `realesr-general-x4v3`, **BSD-3-Clause**, 4,866,428 bytes. ONNX Runtime 1.30.0 is MIT; WASM is 14,239,897 bytes and loader 24,381 bytes. Artifact provenance/digest are in [PROFILE_AI.md](PROFILE_AI.md). The model is still general-purpose, not a face-restoration model.

## GFPGAN v1.4 browser prototype

[Official GFPGAN](https://github.com/TencentARC/GFPGAN) uses a 512px aligned face crop. Whole-photo resizing is not equivalent to face alignment and can distort unrelated content. A production path would need confident face detection/landmarks, similarity alignment, restoration, inverse compositing and honest handling of no-face/group images.

Research-only ONNX: [HowToSD/GFPGAN-ONNX](https://huggingface.co/HowToSD/GFPGAN-ONNX/tree/ae7b761a0dd6da7ccd7d1f02cc584a2f1df39620), pinned revision `ae7b761a0dd6da7ccd7d1f02cc584a2f1df39620`, `GFPGANv1.4.onnx`, **340,357,025 bytes** (324.6 MiB), SHA-256 `15c36ba1a8304e077a9d99954427eac3fb604bb790636dd5e34e72cdeb0830d8`. Opset 16, RGB float32 NCHW in [-1,1], 512×512 input/output. Inspected graph and tested actual inference; numerical parity with official PyTorch weights is **not independently established**.

[Upstream licence](https://github.com/TencentARC/GFPGAN/blob/master/LICENSE) grants Apache-2.0 for GFPGAN except listed third-party components; its full notice also includes NVIDIA terms and DFDNet's noncommercial licence. The conversion card labels its licence `other` and carries those notices. This is not a verified blanket permissive licence for the converted artifact. No GFPGAN weight is committed, hosted or included in production.

`node scripts/prototype-face-restoration.mjs PATH_TO_LOCAL_GFPGAN_ONNX` verifies the pinned digest and runs a loopback-only prototype using the fictional 150px portrait. Its five known landmarks are fitted to the standard aligned-face template; input is normalized to [-1,1], output to RGB at native 512px. This tests alignment/inference mechanics only. It does **not** implement automatic detection or prove real-photo quality. Outputs/measurements remain in ignored `.tools/face-restoration-prototype/`.

WASM inference succeeds in Chromium and Windows WebKit. It allocates **1,060,110,336 bytes** of linear heap, in addition to the 340 MB model buffer, JS tensors, canvases and browser overhead. The dedicated browser process tree's sampled working-set peak was **1,593,712,640 bytes in Chromium** and **1,733,419,008 bytes in WebKit** (~1.59–1.73 GB), including browser baseline; brief peaks may be missed. The unaligned exploratory run took roughly 12 seconds in desktop Chromium and 13 seconds in emulated WebKit. The properly aligned synthetic run takes roughly 13–18 seconds. Cold download was local loopback, not an internet benchmark. At 10 Mbit/s the model alone would take about 272 seconds before overhead. Operators were not the observed blocker; model size, memory, incomplete artifact licensing review and unvalidated real-face identity preservation are blockers to shipping this as a mobile feature.

## Smaller candidates reviewed

| Candidate | Primary evidence | Decision |
| --- | --- | --- |
| SPARNet-Light-Attn3D | [Official architecture/results](https://github.com/chaofengc/Face-SPARNet), 5.24M parameters; [CC BY-NC-SA 4.0](https://github.com/chaofengc/Face-SPARNet/blob/master/LICENSE) | Approximately 21 MB FP32 is attractive, but released face-SR task is 16px→128px, not arbitrary 150/320px restoration. Do not downscale user photos to satisfy it or present the noncommercial licence as permissive. |
| ELSFace | [Official README](https://github.com/FVL2020/ELSFace) claims MIT and also says code is for noncommercial use | Redistribution/commercial scope is unresolved; do not include unverified weights. |
| PCFlow | [Official repository](https://github.com/aiimaginglab/PCFlow) gives MIT code, but task checkpoints are listed as to be released | No ready checkpoint verified; training a replacement is outside this patch. |
| CFRNet | [Author paper](https://arxiv.org/html/2606.06850v1) describes a 2M-parameter 256px face CNN but says code will be released after acceptance | No publicly verified production weight/licence found during this audit. A promising direction, not a deployable choice. |

[YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) has MIT-licensed face detection/landmarks and could supply alignment for a future model; detection alone cannot restore a face. No detector is added to the general-purpose product path.

## Measurements and browser limits

Local Windows desktop hardware; single-thread WASM. Pixel 7 and iPhone 13 descriptions are **emulation**, not physical phone measurements. Timing varies with host load; larger sources are substantially slower. Peak memory numbers below distinguish allocated WASM heap from sampled whole-browser working set.

| Pipeline/input | Native output | Chromium inference | WebKit inference | Allocated WASM heap |
| --- | --- | --- | --- | --- |
| General model, 150px fictional portrait | 600×600 | ~1.6 s | ~1.8–2.2 s | 34,930,688 B |
| General model, 320px fictional portrait, tiled | 1280×1280 | ~11–31 s | ~14–18 s | 57,147,392 B |
| General model, 48×32 logo | 192×128 | ~0.13 s | ~0.17–0.25 s | 24,248,320 B |
| GFPGAN aligned fictional portrait | 512×512 | ~13 s | ~18 s | 1,060,110,336 B |

The sampled general-model browser working-set peak was approximately **356–487 MB**, including the browser baseline; allocated heap is not total memory. Whole-frame 320px reference inference produced **identical RGBA pixels** to the stitched tiles in the tested fixture (maximum difference 0), with larger WASM heap (~93 MB).

WebKit inference passed, but native Safari/iOS devices were unavailable. Actual iPhone tab eviction, memory ceiling, thermal performance and sustained inference remain untested. CSP-compatible production-page tests run in desktop/mobile Chromium; the separate WebKit benchmark verifies ONNX/WASM mechanics without establishing full Safari production certification. No mobile latency or memory-safety guarantee is made.

All committed fixtures are local fictional SVGs. Benchmarks create 150/320px PNG inputs, native outputs and same-view-size before/after comparisons. E2E attachments include source/output, timings and screenshots. Real public-photo exploratory files are local/ignored and are not fixtures or committed artifacts.
