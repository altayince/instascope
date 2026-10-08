# Fictional profile inference fixtures

`portrait.svg` is an original synthetic illustration, not a photograph or a real person. `logo.svg` is an original non-face image. Tests/benchmarks rasterize the portrait at **150×150** and **320×320**, and the logo at **48×32** using the existing Sharp dependency. No personal export or public account photo is committed.

These fixtures check dimensions, pixel preservation, native learned output, tile seams, browser compatibility and sensible non-face behavior. They do **not** prove photographic restoration quality, identity preservation or physical-phone performance.

The benchmark writes inputs, learned outputs, comparison PNGs and timing/memory JSON to ignored `.tools/profile-ai-benchmark/`. Playwright writes source/output attachments and UI screenshots to ignored `test-results/`. The separate face-model prototype uses known synthetic landmarks; it is not an automatic face detector or a product feature.
