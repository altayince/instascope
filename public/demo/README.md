# Local viewer sample

`profile-sample.png` is a deterministic 150 × 150 raster of the repository's original synthetic `tests/fixtures/profile/portrait.svg`. It depicts no real person, contains no Instagram data and is safe to redistribute as part of InstaScope. No third-party photograph or model-generated personal identity is used.

Reproduce with the existing Sharp dependency: `sharp('tests/fixtures/profile/portrait.svg').resize(150, 150).png().toFile('public/demo/profile-sample.png')`.

The sample exercises the same browser-local Real-ESRGAN pipeline as verified public images, producing native 600 × 600 learned output. It does not demonstrate photographic face restoration or authentic HD detail.
