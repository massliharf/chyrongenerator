# Bundled model

`u2netp.onnx` is U²-Netp, the small U²-Net salient object detection model by
Xuebin Qin et al. (https://github.com/xuebinqin/U-2-Net), in the ONNX export
published with rembg (https://github.com/danielgatis/rembg) and redistributed in
the `@planby-tech/rmbg-webgpu` npm package.

License: Apache License 2.0 (see `LICENSE-Apache-2.0.txt`). No changes were made
to the model file.

Chyron Studio uses it for "Remove background → Subject". It runs in the browser
with ONNX Runtime Web (MIT); images never leave the device.
