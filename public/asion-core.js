// Motor de audio 3D de Asion (github.com/UnoYCero/asion, js/asion-core.js, commit 7ddc809),
// copiado sin cambios. Pone cada sonido en un punto del espacio (HRTF), le da acústica al
// lugar y gira la cabeza de quien escucha. Si cambia en Asion, se vuelve a copiar de allá.

export class AsionCore {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        
        this.reverbNode = this.ctx.createConvolver();
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = 0.4;
        this.reverbNode.connect(this.reverbGain);
        this.reverbGain.connect(this.masterGain);

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.masterGain.connect(this.analyser);

        this.sources = [];
        this._lastDur = 3.0;
        this._lastDecay = 3.0;
    }

    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        if (!this.reverbNode.buffer) {
            this.reverbNode.buffer = this.createImpulseResponse(3.0, 3.0);
        }
    }

    createImpulseResponse(duration, decay, reverse = false) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);
        for (let i = 0; i < length; i++) {
            const n = reverse ? length - i : i;
            const vol = Math.pow(1 - n / length, decay);
            left[i] = (Math.random() * 2 - 1) * vol;
            right[i] = (Math.random() * 2 - 1) * vol;
        }
        return impulse;
    }

    setEnvironment(type) {
        let dur = 2.0;
        let decay = 2.0;
        let gain = 0.4;
        switch (type) {
            case 'cave':
                dur = 5.0; decay = 4.0; gain = 0.6;
                break;
            case 'cathedral':
                dur = 7.0; decay = 5.0; gain = 0.7;
                break;
            case 'room':
                dur = 0.8; decay = 1.2; gain = 0.2;
                break;
            case 'studio':
                dur = 0.2; decay = 0.5; gain = 0.1;
                break;
            case 'underwater':
                dur = 1.5; decay = 3.0; gain = 0.8;
                break;
            default:
                dur = 3.0; decay = 3.0; gain = 0.4;
        }
        this.reverbGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.1);
        this._lastDur = dur;
        this._lastDecay = decay;
        this.reverbNode.buffer = this.createImpulseResponse(dur, decay);
    }

    updateListener(angleDegrees) {
        const r = angleDegrees * Math.PI / 180;
        const fx = Math.sin(r);
        const fz = -Math.cos(r);
        
        if (this.ctx.listener.forwardX) {
            const now = this.ctx.currentTime;
            this.ctx.listener.forwardX.setTargetAtTime(fx, now, 0.02);
            this.ctx.listener.forwardY.setTargetAtTime(0, now, 0.02);
            this.ctx.listener.forwardZ.setTargetAtTime(fz, now, 0.02);
            this.ctx.listener.upX.value = 0;
            this.ctx.listener.upY.value = 1;
            this.ctx.listener.upZ.value = 0;
        } else {
            this.ctx.listener.setOrientation(fx, 0, fz, 0, 1, 0);
        }
        return { fx, fz };
    }

    updateListenerPosition(x, y, z) {
        if (this.ctx.listener.positionX) {
            const now = this.ctx.currentTime;
            this.ctx.listener.positionX.setTargetAtTime(x, now, 0.05);
            this.ctx.listener.positionY.setTargetAtTime(y, now, 0.05);
            this.ctx.listener.positionZ.setTargetAtTime(z, now, 0.05);
        } else {
            this.ctx.listener.setPosition(x, y, z);
        }
    }


    addSource(id, buffer, options = {}) {
        if (!buffer) return null;

        const {
            x = 0,
            y = 0,
            z = 0,
            loop = false,
            highpass = false,
            volume = 1.0,
            distanceModel = 'inverse'
        } = options;

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);

        const panner = this.ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = distanceModel;
        panner.refDistance = 1;
        panner.maxDistance = 50;
        panner.positionX.value = x;
        panner.positionY.value = y;
        panner.positionZ.value = z;

        gainNode.connect(panner);
        panner.connect(this.masterGain);
        panner.connect(this.reverbNode);

        const sourceObj = {
            id,
            x,
            y,
            z,
            buffer,
            node: null,
            panner,
            gainNode,
            active: false,
            loop,
            volume,
            highpass,
            distanceModel
        };

        this.sources.push(sourceObj);
        return sourceObj;
    }

    playSound(id, enableLoop = null) {
        const s = this.sources.find(src => src.id === id);
        if (s && s.buffer) {
            try {
                if (s.node) s.node.stop();
            } catch (e) {}

            const src = this.ctx.createBufferSource();
            src.buffer = s.buffer;
            src.loop = enableLoop !== null ? enableLoop : s.loop;

            if (s.highpass) {
                const hp = this.ctx.createBiquadFilter();
                hp.type = "highpass";
                hp.frequency.value = 800;
                src.connect(hp);
                hp.connect(s.gainNode);
            } else {
                src.connect(s.gainNode);
            }

            src.start();
            s.node = src;
            s.active = true;
            
            src.onended = () => {
                if (s.node === src) {
                    s.active = false;
                }
            };
        }
    }

    stopSound(id) {
        const s = this.sources.find(src => src.id === id);
        if (s && s.node) {
            try {
                s.node.stop();
            } catch (e) {}
            s.node = null;
            s.active = false;
        }
    }

    updateSourcePosition(id, x, y, z) {
        const s = this.sources.find(src => src.id === id);
        if (s && s.panner) {
            const now = this.ctx.currentTime;
            s.panner.positionX.setTargetAtTime(x, now, 0.05);
            s.panner.positionY.setTargetAtTime(y, now, 0.05);
            s.panner.positionZ.setTargetAtTime(z, now, 0.05);
            s.x = x;
            s.y = y;
            s.z = z;
        }
    }

    updateSourceVolume(id, volume) {
        const s = this.sources.find(src => src.id === id);
        if (s && s.gainNode) {
            s.gainNode.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
            s.volume = volume;
        }
    }

    removeSource(id) {
        this.stopSound(id);
        this.sources = this.sources.filter(src => src.id !== id);
    }
}
