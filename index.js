var vosk = require('vosk');
var fs = require("fs");
var mic = require("mic");
var levenshtein = require('js-levenshtein');

const MODEL_PATH = "vosk_rus";
const SAMPLE_RATE = 16000;
const COMMAND_THRESHOLD = 0.3; // Порог схожести команды
const REFERENCE_COMMAND = "включи свет";

if (!fs.existsSync(MODEL_PATH)) {
    console.log("Please download the model from https://alphacephei.com/vosk/models and unpack as " + MODEL_PATH + " in the current folder.")
    process.exit();
}

vosk.setLogLevel(0);
const model = new vosk.Model(MODEL_PATH);
const rec = new vosk.Recognizer({model: model, sampleRate: SAMPLE_RATE});

var micInstance = mic({
    rate: String(SAMPLE_RATE),
    channels: '1',
    debug: false,
    device: 'default',
});

var micInputStream = micInstance.getAudioStream();

micInputStream.on('data', data => {
    if (rec.acceptWaveform(data)) {
        const result = rec.result();
        const recognizedCommand = result.text.toLowerCase();
        
        if (recognizedCommand.includes(REFERENCE_COMMAND)) {
            const distance = levenshtein(REFERENCE_COMMAND, recognizedCommand);
            const similarity = 1 - distance / Math.max(REFERENCE_COMMAND.length, recognizedCommand.length);
            
            console.log(`Команда распознана: ${REFERENCE_COMMAND}. Совпадение: ${similarity.toFixed(2)}`);
        }
    }
});

micInputStream.on('audioProcessExitComplete', function() {
    rec.free();
    model.free();
});

process.on('SIGINT', function() {
    console.log("\nStopping");
    micInstance.stop();
});

micInstance.start();
