"""
DubKaroo — self-hosted LatentSync v1.6 (ByteDance) on Modal.

Why this file exists:
  LatentSync is currently the highest-quality open-source lip-sync model.
  v1.6 uses 512px diffusion with DeepCache for ~2x speedup.

Filename note: NOT `latentsync.py` — that would collide with the upstream
`latentsync` Python package and break inference imports.

Deploy:
  modal deploy modal/latentsync_server.py

After deploy, in worker/.env:
  REPLICATE_LIPSYNC_MODEL=modal-latentsync
  LATENTSYNC_MODAL_URL=<endpoint URL>
  LATENTSYNC_AUTH_KEY=<the same WEB_AUTH_KEY in the musetalk-auth secret>

We reuse the existing `musetalk-auth` Modal secret rather than create a second one.
"""

from __future__ import annotations

import modal

APP_NAME = "dubkaroo-latentsync"
LATENTSYNC_REF = "main"  # no tags exist on the LatentSync repo

# Pre-built model tarball that ByteDance/Replicate ship for the LatentSync Cog.
WEIGHTS_TAR_URL = (
    "https://weights.replicate.delivery/default/chunyu-li/LatentSync/model.tar"
)

CUDA_TAG = "12.1.1-cudnn8-devel-ubuntu22.04"

image = (
    modal.Image.from_registry(f"nvidia/cuda:{CUDA_TAG}", add_python="3.10")
    .apt_install(
        "git", "wget", "ffmpeg",
        "libgl1", "libsm6", "libxext6", "libglib2.0-0", "libsndfile1",
        "libgomp1",  # for onnxruntime-gpu
    )
    # PyTorch 2.5.1 / cu121 (matches LatentSync's requirements.txt)
    .pip_install(
        "torch==2.5.1",
        "torchvision==0.20.1",
        index_url="https://download.pytorch.org/whl/cu121",
    )
    # Clone LatentSync at main
    .run_commands(
        "git clone https://github.com/bytedance/LatentSync.git /LatentSync",
        f"cd /LatentSync && git checkout {LATENTSYNC_REF}",
    )
    # insightface==0.7.3 source-builds a Cython C++ extension. Python's distutils
    # sysconfig defaults to `clang++`, which isn't in the CUDA image. Install clang
    # (cheaper than rebusting the apt layer above) before pip-installing.
    .run_commands(
        "apt-get update && apt-get install -y --no-install-recommends clang "
        "&& rm -rf /var/lib/apt/lists/*",
    )
    # Their requirements.txt — pin everything except the torch lines (already installed).
    .run_commands(
        "pip install --no-cache-dir "
        "diffusers==0.32.2 "
        "transformers==4.48.0 "
        "decord==0.6.0 "
        "accelerate==0.26.1 "
        "einops==0.7.0 "
        "omegaconf==2.3.0 "
        "opencv-python==4.9.0.80 "
        "mediapipe==0.10.11 "
        "python_speech_features==0.6 "
        "librosa==0.10.1 "
        "scenedetect==0.6.1 "
        "ffmpeg-python==0.2.0 "
        "imageio==2.31.1 "
        "imageio-ffmpeg==0.5.1 "
        "lpips==0.1.4 "
        "face-alignment==1.4.1 "
        "huggingface-hub==0.30.2 "
        "numpy==1.26.4 "
        "kornia==0.8.0 "
        "insightface==0.7.3 "
        "onnxruntime-gpu==1.21.0 "
        "DeepCache==0.1.1",
    )
    # FastAPI for the web endpoint
    .pip_install("fastapi[standard]==0.115.0", "pydantic==2.9.2")
    # Download LatentSync v1.6 weights from the canonical HuggingFace repo.
    # The Replicate-prebuilt tarball doesn't extract cleanly (paths aren't prefixed
    # with `checkpoints/`). The HF repo gives us full path control via --local-dir.
    # Minimum runtime set per LatentSync v1.6's setup_env.sh:
    #   latentsync_unet.pt           — main UNet (~5.1 GB)
    #   whisper/tiny.pt              — audio encoder (72 MB)
    #   auxiliary/sfd_face.pth       — face detector (86 MB)
    #   auxiliary/vgg16-397923af.pth — perceptual loss / aux (528 MB)
    .run_commands(
        "huggingface-cli download ByteDance/LatentSync-1.6 "
        "latentsync_unet.pt whisper/tiny.pt "
        "auxiliary/sfd_face.pth auxiliary/vgg16-397923af.pth "
        "--local-dir /LatentSync/checkpoints",
        "ls -la /LatentSync/checkpoints /LatentSync/checkpoints/whisper "
        "/LatentSync/checkpoints/auxiliary",
    )
    # Soft-link the auxiliary VGG weight to the torch hub cache (per their predict.py).
    .run_commands(
        "mkdir -p /root/.cache/torch/hub/checkpoints",
        "ln -sf /LatentSync/checkpoints/auxiliary/vgg16-397923af.pth "
        "/root/.cache/torch/hub/checkpoints/vgg16-397923af.pth",
    )
    .workdir("/LatentSync")
    .env({"PYTHONUNBUFFERED": "1", "PYTHONPATH": "/LatentSync"})
)

app = modal.App(APP_NAME)


@app.cls(
    image=image,
    gpu="L4",  # 24GB, ~$0.80/hr, fast for diffusion at 512px
    timeout=30 * 60,
    scaledown_window=300,
    secrets=[modal.Secret.from_name("musetalk-auth", required_keys=["WEB_AUTH_KEY"])],
)
class LatentSyncServer:
    @modal.enter()
    def setup(self):
        import os
        import sys

        sys.path.insert(0, "/LatentSync")
        try:
            import latentsync  # noqa
            print(f"[setup] latentsync OK: __path__={latentsync.__path__}")
        except Exception as e:
            print(f"[setup] latentsync import failed: {e}")
            for p in ("/LatentSync", "/LatentSync/latentsync", "/LatentSync/checkpoints"):
                try:
                    print(f"[setup] ls {p}: {sorted(os.listdir(p))[:20]}")
                except Exception as e2:
                    print(f"[setup] ls {p} failed: {e2}")

        try:
            import torch
            torch.cuda.init()
        except Exception as e:
            print(f"[setup] torch.cuda.init failed: {e}")
        self.WEB_AUTH_KEY = os.environ["WEB_AUTH_KEY"]

    @modal.fastapi_endpoint(method="POST", docs=False)
    def lipsync(self, payload: dict):
        """
        Body: {
          "auth": "<key>",
          "video_url": "...",
          "audio_url": "...",
          "guidance_scale": 1.5,
          "inference_steps": 20,
          "seed": 0,
          "version": "v16"   // "v15" uses stage2.yaml, "v16" uses stage2_512.yaml
        }
        Returns: streaming MP4 bytes.
        """
        import shlex
        import subprocess
        import tempfile
        import time
        import urllib.request
        from pathlib import Path
        from fastapi import HTTPException
        from fastapi.responses import StreamingResponse

        auth = payload.get("auth", "")
        if not self.WEB_AUTH_KEY or auth != self.WEB_AUTH_KEY:
            raise HTTPException(status_code=401, detail="bad auth")

        video_url = payload.get("video_url")
        audio_url = payload.get("audio_url")
        if not video_url or not audio_url:
            raise HTTPException(status_code=400, detail="video_url + audio_url required")

        guidance_scale = float(payload.get("guidance_scale", 1.5))
        inference_steps = int(payload.get("inference_steps", 20))
        seed = int(payload.get("seed", 0))
        version = payload.get("version", "v16")

        if seed <= 0:
            seed = int.from_bytes(__import__("os").urandom(2), "big")

        # v1.6 uses 512px diffusion at stage2_512.yaml; v1.5 uses stage2.yaml.
        unet_cfg = (
            "configs/unet/stage2_512.yaml" if version == "v16" else "configs/unet/stage2.yaml"
        )
        ckpt = "checkpoints/latentsync_unet.pt"

        with tempfile.TemporaryDirectory(prefix="ls-") as work:
            work_dir = Path(work)
            video_path = work_dir / "input.mp4"
            audio_path = work_dir / "input.wav"
            output_path = work_dir / "output.mp4"

            t0 = time.time()
            print("[lipsync] downloading inputs")
            urllib.request.urlretrieve(video_url, video_path)
            urllib.request.urlretrieve(audio_url, audio_path)
            print(f"[lipsync] downloaded in {time.time()-t0:.1f}s")

            cmd = [
                "python", "-m", "scripts.inference",
                "--unet_config_path", unet_cfg,
                "--inference_ckpt_path", ckpt,
                "--inference_steps", str(inference_steps),
                "--guidance_scale", str(guidance_scale),
                "--enable_deepcache",
                "--video_path", str(video_path),
                "--audio_path", str(audio_path),
                "--video_out_path", str(output_path),
                "--seed", str(seed),
            ]
            print(f"[lipsync] running: {' '.join(shlex.quote(x) for x in cmd)}")

            t1 = time.time()
            proc = subprocess.run(
                cmd, cwd="/LatentSync", capture_output=True, text=True, timeout=25 * 60
            )
            print(f"[lipsync] inference {time.time()-t1:.1f}s exit={proc.returncode}")
            if proc.returncode != 0:
                print(proc.stdout[-4000:])
                print(proc.stderr[-4000:])
                raise HTTPException(
                    status_code=500,
                    detail=f"latentsync inference failed: {proc.stderr[-1000:]}",
                )

            if not output_path.exists():
                raise HTTPException(status_code=500, detail="no output produced")
            data = output_path.read_bytes()

        return StreamingResponse(
            iter([data]),
            media_type="video/mp4",
            headers={"content-length": str(len(data))},
        )

    @modal.fastapi_endpoint(method="GET", docs=False)
    def health(self) -> dict:
        return {"ok": True, "model": "latentsync", "ref": LATENTSYNC_REF}
