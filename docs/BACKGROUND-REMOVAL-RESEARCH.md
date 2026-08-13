# Background-removal dependency review

Reviewed on 2026-08-13 for CJNET's commercial, private internal use.

## Rejected: `@imgly/background-removal`

IMG.LY's browser library is technically convenient and processes images locally, but its free license is AGPL-3.0. Using it in a private proprietary application would require a deliberate AGPL compliance decision or a separate commercial license. PhotoDesk does not include it.

## Rejected for now: `@huggingface/transformers` 4.2.0 + MODNet

The runtime and `onnx-community/modnet-webnn` model are labeled Apache-2.0 and offer a clean browser pipeline. A production `npm audit`, however, reported four unresolved high-severity vulnerabilities in mandatory Node dependencies pulled into the package (`onnxruntime-node`/`adm-zip` and bundled `sharp`). The dependency was immediately removed; a follow-up production audit returned zero vulnerabilities.

## Selected: MediaPipe Image Segmenter

PhotoDesk uses `@mediapipe/tasks-vision` 0.10.35 and Google's selfie-segmentation model. The MediaPipe repository and runtime are Apache-2.0, which permits commercial internal use subject to the license and notice terms. Processing occurs on-device and the implementation sends no customer image to a CJNET or per-image AI API.

The first use downloads version-pinned WebAssembly runtime assets and the model from Google/CDN hosting. The model is stored in the browser Cache API and the interface reports download and processing progress. Browser HTTP caching also applies to runtime assets. MediaPipe's project documentation notes collection of anonymous usage/performance metrics; CJNET should include that fact in its privacy review even though portrait pixels are processed locally.

The selfie model targets one prominent person near the camera, which matches ID-photo input. It will not be equally accurate on every hairstyle, clothing/background combination, so real shop-sample acceptance testing remains required.

## Implementation rule

The engine sits behind `BackgroundRemovalProvider`, downloads/caches model assets with visible progress, keeps image pixels on the device, and returns a transparent PNG blob. The page depends on the interface rather than MediaPipe's API so the engine can be replaced later.
