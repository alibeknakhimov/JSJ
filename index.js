const { Porcupine } = require("@picovoice/porcupine-node");
const { PvRecorder } = require("@picovoice/pvrecorder-node");
const WebSocket = require('ws');
var vosk = require('vosk');
var fs = require("fs");
var mic = require("mic");
var levenshtein = require('js-levenshtein');
const player = require('play-sound')();
const audioFilePaths = ['audio/greet1.wav', 'audio/greet2.wav', 'audio/greet3.wav'];
const doneAudioFilePaths = ['audio/ok1.wav', 'audio/ok2.wav', 'audio/ok3.wav'];
const thanksAudioFilePath = ['audio/thanks.wav'];
const MODEL_PATH = "vosk_rus";
const SAMPLE_RATE = 16000;
const REFERENCE_COMMAND = "открой дверь";
const COMMAND_THRESHOLD = 0.70;

let isListeningForWakeWord = false;

const porcupine = new Porcupine(
    "1VdXMAPnLWa62EV5fPnCs4NR+052DBScPbuA7OjptSAP/IB2KEDfKQ==",
    ["Jarvis_en_linux_v3_0_0.ppn"],
    [1.0] // Устанавливаем порог для обнаружения ключевого слова
);
const recorder = new PvRecorder(512);

async function startWakeWordDetection() {
    isListeningForWakeWord = true;
    recorder.start();
    while (isListeningForWakeWord) {
        const frames = await recorder.read();
        const keywordIndex = porcupine.process(frames);
        if (keywordIndex !== -1) {
            console.log("Ключевое слово 'Jarvis' обнаружено. Активация голосового ассистента...");
            const randomIndex = Math.floor(Math.random() * audioFilePaths.length);
            const selectedAudioFilePath = audioFilePaths[randomIndex];
            player.play(selectedAudioFilePath, function(err){
                if (err) {
                  console.error('Ошибка воспроизведения:', err);
                } else {
                  console.log('Аудиофайл успешно воспроизведен');
                }
              });
            isListeningForWakeWord = false;
            startCommandRecognition();
        }
    }
}
async function sendMessage(message) {
    const ws = new WebSocket('ws://192.168.0.200:1880/ws/testing');

    ws.on('open', function open() {
        console.log('WebSocket connected');
        ws.send(message);
        console.log(`Message sent: ${message}`);
        ws.close();
    });

    ws.on('close', function close() {
        console.log('WebSocket disconnected');
    });

    ws.on('error', function error(err) {
        console.error('WebSocket error:', err);
    });
}
async function startCommandRecognition() {
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
            const distance = levenshtein(REFERENCE_COMMAND, recognizedCommand);
            const distanceThanks = levenshtein('спасибо', recognizedCommand);
            const similarity = 1 - distance / Math.max(REFERENCE_COMMAND.length, recognizedCommand.length);
            const similarityThanks = 1 - distanceThanks / Math.max('спасибо'.length, recognizedCommand.length);
            console.log(`Совпадение с командой: ${similarity.toFixed(2)}`);
            console.log(`Совпадение с командой "спасибо": ${similarityThanks.toFixed(2)}`);
            if (similarity >= COMMAND_THRESHOLD) {
                console.log(`Команда распознана: ${REFERENCE_COMMAND}`);
                const doneRandomIndex = Math.floor(Math.random() * doneAudioFilePaths.length);
                const doneSelectedAudioFilePath = doneAudioFilePaths[doneRandomIndex];
                sendMessage('alibek');
                player.play(doneSelectedAudioFilePath, function(err){
                if (err) {
                  console.error('Ошибка воспроизведения:', err);
                } else {
                  console.log('Аудиофайл успешно воспроизведен');
                }
                });
                micInstance.stop();
                startWakeWordDetection();
            }
            else if (similarityThanks >= COMMAND_THRESHOLD) {
                console.log('Команда распознана: спасибо');
                console.log('Всегда к вашим услугам, сэр');
                player.play(thanksAudioFilePath, function(err){
                if (err) {
                    console.error('Ошибка воспроизведения:', err);
                } else {
                    console.log('Аудиофайл успешно воспроизведен');
                }
                });
                micInstance.stop();
                startWakeWordDetection();
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
}

startWakeWordDetection();
