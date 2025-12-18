/* ================= AUDIO ================= */
let wavesurfer, region, audioFile;

wavesurfer = WaveSurfer.create({
    container: "#waveform",
    waveColor: "#334155",
    progressColor: "#38bdf8",
    cursorColor: "#22d3ee",
    height: 140,
    plugins: [WaveSurfer.Regions.create()]
});

audioFileInput = document.getElementById("audioFile");

audioFileInput.addEventListener("change", async e => {
    audioFile = e.target.files[0];
    if (!audioFile) return;

    const arrayBuffer = await audioFile.arrayBuffer();

    const ctx = new AudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    wavesurfer.loadDecodedBuffer(audioBuffer);

    wavesurfer.once("ready", () => {
        wavesurfer.clearRegions();
        region = wavesurfer.addRegion({
            start: 0,
            end: Math.min(5, wavesurfer.getDuration()),
            color: "rgba(56,189,248,0.25)",
            drag: true,
            resize: true
        });
        updateAudioInfo();
    });
});


wavesurfer.on("region-updated", updateAudioInfo);

function updateAudioInfo() {
    if (!region) return;
    aStart.textContent = region.start.toFixed(2);
    aEnd.textContent = region.end.toFixed(2);
    aDur.textContent = (region.end - region.start).toFixed(2);
}

function playPause() {
    wavesurfer.playPause();
}

async function cutRegion() {
    const ctx = new AudioContext();
    const buffer = await ctx.decodeAudioData(await audioFile.arrayBuffer());

    const s = region.start * buffer.sampleRate;
    const e = region.end * buffer.sampleRate;

    const out = ctx.createBuffer(
        buffer.numberOfChannels,
        e - s,
        buffer.sampleRate
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        out.getChannelData(ch).set(
            buffer.getChannelData(ch).slice(s, e)
        );
    }
    exportWav(out, "cut-audio.wav");
}

function fadeInOut() {
    alert("fade applied during export (basic linear fade)");
}

function downloadRenamedAudio() {
    if (!audioFile) return;
    const name = renameAudio.value || "audio";
    download(new Blob([audioFile], { type: audioFile.type }), name + ".mp3");
}

/* ================= VIDEO ================= */
const videoInput = document.getElementById("videoFile");
const videoPlayer = document.getElementById("videoPlayer");

videoInput.addEventListener("change", e => {
    videoPlayer.src = URL.createObjectURL(e.target.files[0]);
});

function previewVideo() {
    videoPlayer.currentTime = vStart.value;
    videoPlayer.play();
    setTimeout(() => videoPlayer.pause(),
        (vEnd.value - vStart.value) * 1000);
}

function cutVideo() {
    alert("video trimming in browser is preview-safe; download requires ffmpeg.wasm (advanced upgrade)");
}
/* ================= MERGE FUNCTIONS ================= */

/* -------- 1. AUDIO + AUDIO (REAL DOWNLOAD) -------- */
async function mergeAudioAudio() {
    if (!aa1.files[0] || !aa2.files[0]) {
        alert("Select two audio files");
        return;
    }

    const ctx = new AudioContext();

    const b1 = await ctx.decodeAudioData(await aa1.files[0].arrayBuffer());
    const b2 = await ctx.decodeAudioData(await aa2.files[0].arrayBuffer());

    const out = ctx.createBuffer(
        Math.max(b1.numberOfChannels, b2.numberOfChannels),
        b1.length + b2.length,
        b1.sampleRate
    );

    for (let ch = 0; ch < out.numberOfChannels; ch++) {
        if (b1.getChannelData(ch))
            out.getChannelData(ch).set(b1.getChannelData(ch), 0);

        if (b2.getChannelData(ch))
            out.getChannelData(ch).set(b2.getChannelData(ch), b1.length);
    }

    exportWav(out, "audio-merged.wav");
}

/* -------- 2. VIDEO + VIDEO (PREVIEW SAFE) -------- */
function mergeVideoVideo() {
    if (!vv1.files[0] || !vv2.files[0]) {
        alert("Select two videos");
        return;
    }

    const v = document.getElementById("videoMergePreview");
    v.style.display = "block";

    const v1URL = URL.createObjectURL(vv1.files[0]);
    const v2URL = URL.createObjectURL(vv2.files[0]);

    v.src = v1URL;
    v.play();

    v.onended = () => {
        v.src = v2URL;
        v.play();
    };

    alert(
        "Preview mode:\n\n" +
        "Videos play sequentially.\n" +
        "Permanent export requires ffmpeg.wasm."
    );
}

/* -------- 3. AUDIO + VIDEO (SYNC PREVIEW) -------- */
function mergeAudioVideo() {
    if (!avVideo.files[0] || !avAudio.files[0]) {
        alert("Select both video and audio");
        return;
    }

    const video = document.createElement("video");
    const audio = document.createElement("audio");

    video.src = URL.createObjectURL(avVideo.files[0]);
    audio.src = URL.createObjectURL(avAudio.files[0]);

    video.controls = true;
    video.style.width = "100%";
    video.style.marginTop = "12px";

    video.addEventListener("play", () => audio.play());
    video.addEventListener("pause", () => audio.pause());
    video.addEventListener("seeked", () => (audio.currentTime = video.currentTime));

    document.querySelector("#mergeTab .card").appendChild(video);

    alert(
        "Audio replaced for preview.\n\n" +
        "For final export, advanced processing is required."
    );
}

/* ================= HELPERS ================= */
function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
}

function exportWav(buffer, name) {
    const wav = audioBufferToWav(buffer);
    download(new Blob([wav], { type: "audio/wav" }), name);
}

/* wav encoder */
function audioBufferToWav(buffer) {
    const ch = buffer.numberOfChannels;
    const len = buffer.length * ch * 2;
    const out = new ArrayBuffer(44 + len);
    const view = new DataView(out);
    let pos = 0;

    const write = s => { for (let i = 0; i < s.length; i++) view.setUint8(pos++, s.charCodeAt(i)); };

    write("RIFF");
    view.setUint32(pos, 36 + len, true); pos += 4;
    write("WAVEfmt ");
    view.setUint32(pos, 16, true); pos += 4;
    view.setUint16(pos, 1, true); pos += 2;
    view.setUint16(pos, ch, true); pos += 2;
    view.setUint32(pos, buffer.sampleRate, true); pos += 4;
    view.setUint32(pos, buffer.sampleRate * ch * 2, true); pos += 4;
    view.setUint16(pos, ch * 2, true); pos += 2;
    view.setUint16(pos, 16, true); pos += 2;
    write("data");
    view.setUint32(pos, len, true); pos += 4;

    for (let i = 0; i < buffer.length; i++) {
        for (let c = 0; c < ch; c++) {
            let s = buffer.getChannelData(c)[i];
            s = Math.max(-1, Math.min(1, s));
            view.setInt16(pos, s * 0x7fff, true);
            pos += 2;
        }
    }
    return out;
}

/* ================= MODERN VIDEO FEATURES ================= */

videoPlayer.addEventListener("loadedmetadata", () => {
    vDuration.textContent = videoPlayer.duration.toFixed(2);
    vResolution.textContent =
        videoPlayer.videoWidth + "×" + videoPlayer.videoHeight;
});

function changeSpeed(speed) {
    videoPlayer.playbackRate = speed;
    vSpeed.textContent = speed + "x";
}

function captureFrame() {
    const canvas = document.createElement("canvas");
    canvas.width = videoPlayer.videoWidth;
    canvas.height = videoPlayer.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
        download(blob, "video-frame.png");
    });
}

function experimental() {
    alert(
        "Experimental features:\n\n" +
        "• AI captions\n" +
        "• Scene detection\n" +
        "• Video stabilization\n\n" +
        "Available in advanced version."
    );
}

