"""
DubKaroo — self-hosted MuseTalk on Modal.

Why this file exists:
  No public Replicate deployment of MuseTalk lets us pin the upstream version.
  Self-hosting on Modal does. This builds a CUDA image with MuseTalk's repo +
  weights baked in, exposes a FastAPI endpoint that takes (video_url, audio_url)
  and returns the lip-synced MP4 bytes.

Deploy:
  cd /Users/nandhakumarilangovan/dbkaroo
  modal deploy modal/musetalk.py

After deploy:
  - Modal prints an HTTPS endpoint URL.
  - Set in `worker/.env`:
      MUSETALK_MODAL_URL=<that URL>
      MUSETALK_AUTH_KEY=<the key you'll set as a Modal secret below>
  - Set REPLICATE_LIPSYNC_MODEL=modal-musetalk in worker/.env

Auth:
  Endpoint requires an `x-auth-key` header matching the `WEB_AUTH_KEY` secret.
  Create the secret once before deploy:
      modal secret create musetalk-auth WEB_AUTH_KEY=<random-32-char-string>
"""

from __future__ import annotations

import modal

APP_NAME = "dubkaroo-musetalk"

# Pin a specific MuseTalk commit. v1.5 release tag = ~Nov 2024.
# Override with MUSETALK_REF env var at deploy time if needed.
MUSETALK_REF = "v1.5"  # tag

# CUDA image — match torch CUDA build.
CUDA_TAG = "12.1.1-cudnn8-devel-ubuntu22.04"

image = (
    modal.Image.from_registry(f"nvidia/cuda:{CUDA_TAG}", add_python="3.10")
    # System deps for MuseTalk + ffmpeg + opencv
    .apt_install(
        "git",
        "wget",
        "ffmpeg",
        "libgl1",
        "libsm6",
        "libxext6",
        "libglib2.0-0",
        "libsndfile1",
    )
    # PyTorch matched to CUDA 12.1
    .pip_install(
        "torch==2.1.2",
        "torchvision==0.16.2",
        "torchaudio==2.1.2",
        index_url="https://download.pytorch.org/whl/cu121",
    )
    # HuggingFace CLI for downloading weights
    .pip_install(
        "huggingface_hub[cli]==0.25.2",
        "fastapi[standard]==0.115.0",
        "pydantic==2.9.2",
        "requests==2.32.3",
    )
    # Clone MuseTalk at a pinned ref. If the tag doesn't exist, fall back to main.
    .run_commands(
        "git clone https://github.com/TMElyralab/MuseTalk.git /MuseTalk",
        f"cd /MuseTalk && (git checkout {MUSETALK_REF} || (echo 'tag not found, using main' && git checkout main))",
    )
    # MuseTalk's own python deps. Some pins may conflict with torch above; install with --no-deps if needed.
    .run_commands(
        "cd /MuseTalk && pip install --no-cache-dir "
        "diffusers==0.30.2 accelerate==0.34.2 transformers==4.45.2 "
        "einops==0.8.0 omegaconf==2.3.0 librosa==0.10.2.post1 soundfile==0.12.1 "
        "opencv-python==4.10.0.84 imageio==2.36.0 imageio-ffmpeg==0.5.1 "
        "openmim==0.3.9 numpy==1.26.4 scipy==1.13.1 tqdm==4.66.5 "
        "ffmpeg-python==0.2.0",
    )
    # mmcv stack.
    #   - mmcv 2.1.0 has pre-built wheels for cu121/torch2.1 — point pip at the
    #     OpenMMLab mirror so we don't source-build (which fails on setuptools>=80
    #     due to the pkg_resources removal).
    #   - mmpose 1.2.0 pulls in `chumpy`, which has an ancient setup.py that does
    #     `import pip` and fails under build isolation. Install chumpy first with
    #     --no-build-isolation so it uses the system pip.
    .run_commands(
        "pip install --no-cache-dir 'mmengine==0.10.4'",
        "pip install --no-cache-dir 'mmcv==2.1.0' "
        "-f https://download.openmmlab.com/mmcv/dist/cu121/torch2.1.0/index.html",
        "pip install --no-cache-dir 'setuptools<80' wheel pip",
        "pip install --no-cache-dir --no-build-isolation chumpy",
        "pip install --no-cache-dir 'mmdet==3.2.0' 'mmpose==1.2.0'",
    )
    # Download all the model weights at build time so cold starts are fast.
    # Mirrors MuseTalk's official `download_weights.sh`:
    #   - MuseTalk v1.0 + v1.5 (TMElyralab/MuseTalk on HF)
    #   - SD-VAE (stabilityai/sd-vae-ft-mse)
    #   - Whisper tiny (openai/whisper-tiny)
    #   - DWPose (yzd-v/DWPose)               ← needed for face landmarks
    #   - SyncNet (ByteDance/LatentSync)
    #   - face-parse-bisent (Google Drive)    ← needed for face parsing
    .pip_install("gdown==5.2.0")
    .run_commands(
        "mkdir -p /MuseTalk/models/musetalk /MuseTalk/models/musetalkV15 "
        "/MuseTalk/models/sd-vae /MuseTalk/models/whisper "
        "/MuseTalk/models/dwpose /MuseTalk/models/face-parse-bisent /MuseTalk/models/syncnet",
        'huggingface-cli download TMElyralab/MuseTalk --local-dir /MuseTalk/models '
        '--include "musetalk/musetalk.json" "musetalk/pytorch_model.bin" '
        '"musetalkV15/musetalk.json" "musetalkV15/unet.pth"',
        'huggingface-cli download stabilityai/sd-vae-ft-mse --local-dir /MuseTalk/models/sd-vae '
        '--include "config.json" "diffusion_pytorch_model.bin"',
        'huggingface-cli download openai/whisper-tiny --local-dir /MuseTalk/models/whisper '
        '--include "config.json" "pytorch_model.bin" "preprocessor_config.json"',
        'huggingface-cli download yzd-v/DWPose --local-dir /MuseTalk/models/dwpose '
        '--include "dw-ll_ucoco_384.pth"',
        'huggingface-cli download ByteDance/LatentSync --local-dir /MuseTalk/models/syncnet '
        '--include "latentsync_syncnet.pt"',
        "gdown --id 154JgKpzCPW82qINcVieuPH3fZ2e0P812 "
        "-O /MuseTalk/models/face-parse-bisent/79999_iter.pth",
        "wget -q https://download.pytorch.org/models/resnet18-5c106cde.pth "
        "-O /MuseTalk/models/face-parse-bisent/resnet18-5c106cde.pth",
    )
    .workdir("/MuseTalk")
    # MuseTalk's repo doesn't ship `__init__.py` at the package root, relying on PEP 420
    # namespace packages — but the realtime_inference script imports submodules eagerly
    # which fails. Touching __init__.py everywhere makes them regular packages.
    .run_commands(
        "find /MuseTalk/musetalk -type d -exec touch {}/__init__.py \\;",
        "ls /MuseTalk/musetalk/__init__.py /MuseTalk/musetalk/utils/__init__.py "
        "/MuseTalk/musetalk/utils/face_parsing/__init__.py",
    )
    .env({"PYTHONUNBUFFERED": "1", "PYTHONPATH": "/MuseTalk"})
)

app = modal.App(APP_NAME)

# 30 minutes max per request, keep warm 5 minutes after last call.
@app.cls(
    image=image,
    gpu="T4",
    timeout=30 * 60,
    scaledown_window=300,
    secrets=[modal.Secret.from_name("musetalk-auth", required_keys=["WEB_AUTH_KEY"])],
)
class MuseTalkServer:
    @modal.enter()
    def setup(self):
        import os
        import sys
        import subprocess

        # Make musetalk and its subpackages "real" packages by touching __init__.py
        # everywhere in the tree. The repo ships a namespace-style layout that
        # confuses some import paths (e.g. "musetalk is not a package").
        subprocess.run(
            "find /MuseTalk/musetalk -type d -exec touch {}/__init__.py \\;",
            shell=True, check=True,
        )
        subprocess.run(
            "find /MuseTalk/scripts -type d -exec touch {}/__init__.py \\;",
            shell=True, check=True,
        )

        sys.path.insert(0, "/MuseTalk")

        # Diagnostic: confirm Python now sees musetalk as a package.
        try:
            import musetalk  # type: ignore
            print(f"[setup] musetalk OK: __path__={musetalk.__path__}")
        except Exception as e:
            print(f"[setup] musetalk import failed: {e}")
            # List dir for diagnosis
            for p in ("/MuseTalk", "/MuseTalk/musetalk", "/MuseTalk/musetalk/utils"):
                try:
                    print(f"[setup] ls {p}: {sorted(os.listdir(p))}")
                except Exception as e2:
                    print(f"[setup] ls {p} failed: {e2}")

        # Touch CUDA so first request doesn't pay init cost.
        try:
            import torch
            torch.cuda.init()
        except Exception as e:
            print(f"[setup] torch.cuda.init failed: {e}")
        self.WEB_AUTH_KEY = os.environ["WEB_AUTH_KEY"]

    @modal.fastapi_endpoint(method="POST", docs=False)
    def lipsync(self, payload: dict):
        """
        Body: { "auth": "...", "video_url": "...", "audio_url": "...",
                 "bbox_shift": 0, "fps": 25, "version": "v15" }
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

        # Auth: simple shared-secret check via JSON body.
        auth = payload.get("auth", "")
        if not self.WEB_AUTH_KEY or auth != self.WEB_AUTH_KEY:
            raise HTTPException(status_code=401, detail="bad auth")

        video_url = payload.get("video_url")
        audio_url = payload.get("audio_url")
        if not video_url or not audio_url:
            raise HTTPException(status_code=400, detail="video_url + audio_url required")

        bbox_shift = int(payload.get("bbox_shift", 0))
        fps = int(payload.get("fps", 25))
        version = payload.get("version", "v15")  # "v1" | "v15"

        # Workspace per-request
        with tempfile.TemporaryDirectory(prefix="dub-") as work:
            work_dir = Path(work)
            video_path = work_dir / "input.mp4"
            audio_path = work_dir / "input.wav"
            result_dir = work_dir / "result"
            result_dir.mkdir(parents=True, exist_ok=True)

            t0 = time.time()
            print(f"[lipsync] downloading inputs")
            urllib.request.urlretrieve(video_url, video_path)
            urllib.request.urlretrieve(audio_url, audio_path)
            print(f"[lipsync] downloaded in {time.time()-t0:.1f}s")

            # MuseTalk's `scripts/inference.py` (one-shot mode) reads task_* entries.
            # `realtime_inference.py` is for the avatar-precompute flow and requires a
            # different schema (preparation/audio_clips) — we don't want that.
            cfg_path = work_dir / "config.yaml"
            cfg_path.write_text(
                "task_0:\n"
                f'  video_path: "{video_path}"\n'
                f'  audio_path: "{audio_path}"\n'
                f"  bbox_shift: {bbox_shift}\n"
                '  result_name: "output.mp4"\n'
            )

            cmd = [
                "python", "-m", "scripts.inference",
                "--inference_config", str(cfg_path),
                "--result_dir", str(result_dir),
                "--gpu_id", "0",
                "--use_float16",
            ]
            if version == "v15":
                cmd += [
                    "--version", "v15",
                    "--unet_model_path", "./models/musetalkV15/unet.pth",
                    "--unet_config", "./models/musetalkV15/musetalk.json",
                    "--whisper_dir", "./models/whisper",
                ]
            else:
                cmd += ["--version", "v1"]
            print(f"[lipsync] running: {' '.join(shlex.quote(x) for x in cmd)}")

            t1 = time.time()
            proc = subprocess.run(
                cmd, cwd="/MuseTalk", capture_output=True, text=True, timeout=25 * 60
            )
            print(f"[lipsync] inference {time.time()-t1:.1f}s exit={proc.returncode}")
            if proc.returncode != 0:
                print(proc.stdout[-4000:])
                print(proc.stderr[-4000:])
                raise HTTPException(
                    status_code=500,
                    detail=f"musetalk inference failed: {proc.stderr[-1000:]}",
                )

            # inference.py writes to {result_dir}/{version}/{result_name}; rglob finds it.
            mp4s = sorted(result_dir.rglob("*.mp4"))
            if not mp4s:
                raise HTTPException(status_code=500, detail="no output video produced")
            out_path = mp4s[-1]
            data = out_path.read_bytes()

        return StreamingResponse(
            iter([data]),
            media_type="video/mp4",
            headers={"content-length": str(len(data))},
        )

    @modal.fastapi_endpoint(method="GET", docs=False)
    def health(self) -> dict:
        return {"ok": True, "musetalk_ref": MUSETALK_REF}
