import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Camera, RotateCcw, X } from 'lucide-react';

const CAMERA_KEY = 'stockit_scanner_camera';
const SCAN_EVERY_MS = 150;
const MAX_DECODE_WIDTH = 1280;

// The last barcode this scanner accepted. Kept at module level (not in a page's
// state) so it survives leaving and reopening the Add Product page: after saving
// a product the phone is usually still pointing at that same barcode.
let lastAcceptedCode = '';

// Retail and shelf-label formats, decoded in the slower but more thorough mode,
// which reads small or slightly tilted barcodes (on pens, bottles) far better.
const HINTS = new Map([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
  ]],
]);

// The part of the camera picture that is read: the green box on screen, with a
// little margin. Anything outside it (a neighbouring barcode) is ignored.
// The video is shown with object-fit: cover, so screen positions are mapped
// back to video pixels here.
function scanRegion(video) {
  const { width: shownWidth, height: shownHeight } = video.getBoundingClientRect();
  const scale = Math.max(shownWidth / video.videoWidth, shownHeight / video.videoHeight);
  const visibleWidth = shownWidth / scale;
  const visibleHeight = shownHeight / scale;
  const left = (video.videoWidth - visibleWidth) / 2;
  const top = (video.videoHeight - visibleHeight) / 2;
  return {
    x: left + visibleWidth * 0.08,
    y: top + visibleHeight * 0.22,
    width: visibleWidth * 0.84,
    height: visibleHeight * 0.56,
  };
}

// Camera barcode scanner. Works with any camera the browser can see, including
// a phone used as a webcam through DroidCam (it shows up as "DroidCam Video").
// The barcode read last time is never accepted automatically, because the camera
// is usually still pointing at it when the scanner reopens; the user can choose
// "Use it again" instead.
export function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState('');
  const [message, setMessage] = useState('Starting camera…');
  const [repeatCode, setRepeatCode] = useState('');

  // Ask for camera access once, then list every camera so DroidCam can be picked.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot use a camera here (it needs https or localhost).');
        const probe = await navigator.mediaDevices.getUserMedia({ video: true });
        probe.getTracks().forEach((track) => track.stop());
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        if (devices.length === 0) throw new Error('No camera found. Start DroidCam on your phone and PC, then try again.');
        setCameras(devices);
        let saved = '';
        try { saved = localStorage.getItem(CAMERA_KEY) || ''; } catch { /* storage unavailable */ }
        const droidCam = devices.find((device) => /droidcam/i.test(device.label));
        setCameraId((devices.find((device) => device.deviceId === saved) || droidCam || devices[0]).deviceId);
      } catch (error) {
        if (!cancelled) setMessage(error.name === 'NotAllowedError' ? 'Camera access was blocked. Allow it in the browser and try again.' : error.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Read the green-box area of the chosen camera a few times a second until a new barcode appears.
  useEffect(() => {
    const video = videoRef.current;
    if (!cameraId || !video) return undefined;
    try { localStorage.setItem(CAMERA_KEY, cameraId); } catch { /* storage unavailable */ }

    const reader = new BrowserMultiFormatReader(HINTS);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let stream;
    let timer;
    let stopped = false;
    const stop = () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };

    const scanFrame = () => {
      if (stopped || !video.videoWidth) return;
      const region = scanRegion(video);
      const shrink = Math.min(1, MAX_DECODE_WIDTH / region.width);
      canvas.width = Math.round(region.width * shrink);
      canvas.height = Math.round(region.height * shrink);
      context.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, canvas.width, canvas.height);
      let text;
      try {
        text = reader.decodeFromCanvas(canvas).getText();
      } catch {
        return; // no barcode in the box yet
      }
      if (text === lastAcceptedCode) {
        setRepeatCode(text);
        setMessage(`That is ${text}, the barcode you just scanned. Point the box at the next one.`);
        return;
      }
      stop();
      lastAcceptedCode = text;
      onDetected(text);
    };

    (async () => {
      try {
        setMessage('Starting camera…');
        // Ask for HD: thin bars on small barcodes are lost at 640×480.
        stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: cameraId }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        setMessage('Fit one barcode inside the green box');
        timer = setInterval(scanFrame, SCAN_EVERY_MS);
      } catch (error) {
        if (!stopped) setMessage(`Could not start this camera: ${error.message}`);
      }
    })();

    return stop;
  }, [cameraId, onDetected]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="scanner-modal panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Barcode scanner">
        <div className="panel-heading">
          <div><p className="eyebrow">Camera</p><h2>Scan barcode</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close scanner"><X size={17} /></button>
        </div>
        {cameras.length > 0 && (
          <label className="field scanner-camera">
            <span>Camera</span>
            <select value={cameraId} onChange={(event) => setCameraId(event.target.value)} aria-label="Choose camera">
              {cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
            </select>
          </label>
        )}
        <div className="scanner-view">
          <video ref={videoRef} muted playsInline />
          <span className="scanner-frame" aria-hidden="true" />
        </div>
        <p className="scanner-message" role="status"><Camera size={14} /> {message}</p>
        {repeatCode && (
          <button type="button" className="secondary-action scanner-repeat" onClick={() => onDetected(repeatCode)}>
            <RotateCcw size={14} /> Use {repeatCode} again
          </button>
        )}
        <p className="scanner-help">Only the barcode inside the green box is read. Keep it flat and still, in good light. Small curved barcodes (pens) are hard; a flat packet works best.</p>
        <p className="scanner-help">Using your phone: install <b>DroidCam</b> on the phone and the DroidCam Client on this PC, connect both to the same Wi-Fi, enter the phone's IP in the client, then pick <b>DroidCam Video</b> above.</p>
      </section>
    </div>
  );
}
