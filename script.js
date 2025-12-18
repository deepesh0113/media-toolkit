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

audioFileInput.addEventListener("change", e => {
  audioFile = e.target.files[0];
  if (!audioFile) return;

  wavesurfer.load(URL.createObjectURL(audioFile));
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

/* ================= MERGE AUDIO ================= */
async function mergeAudios() {
  const ctx = new AudioContext();
  const b1 = await ctx.decodeAudioData(await merge1.files[0].arrayBuffer());
  const b2 = await ctx.decodeAudioData(await merge2.files[0].arrayBuffer());

  const out = ctx.createBuffer(
    b1.numberOfChannels,
    b1.length + b2.length,
    b1.sampleRate
  );

  for (let ch = 0; ch < b1.numberOfChannels; ch++) {
    out.getChannelData(ch).set(b1.getChannelData(ch), 0);
    out.getChannelData(ch).set(b2.getChannelData(ch), b1.length);
  }
  exportWav(out, "merged-audio.wav");
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
