const { Porcupine } = require("@picovoice/porcupine-node");
const { PvRecorder } = require("@picovoice/pvrecorder-node");
const WebSocket = require('ws');
var vosk = require('vosk');
var fs = require("fs");
var mic = require("mic");
var levenshtein = require('js-levenshtein');
const player = require('play-sound')();
const { exec } = require('child_process');
const audioFilePaths = ['audio/greet1.wav', 'audio/greet2.wav', 'audio/greet3.wav'];
const doneAudioFilePaths = ['audio/ok1.wav', 'audio/ok2.wav', 'audio/ok3.wav'];
const thanksAudioFilePath = ['audio/thanks.wav'];
const MODEL_PATH = "vosk_rus";
const SAMPLE_RATE = 16000;
const REFERENCE_COMMAND = "открой дверь";
const COMMAND_THRESHOLD = 0.70;

let isListeningForWakeWord = false;

const porcupine = new Porcupine(
    "XRpmKl8diU1EIuplShvBmmyNAKvErLRMewM0FFxKL5zv/DfKmrmjAQ==",
    ["Jarvis_en_linux_v3_0_0.ppn"],
    [0.775] // Устанавливаем порог для обнаружения ключевого слова
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
            const distanceOpenDoor = levenshtein('открой дверь', recognizedCommand);
            const distanceAboutMe = levenshtein('расскажи о себе', recognizedCommand);
            const distanceOpenBrowser = levenshtein('открой браузер', recognizedCommand);
            const distancePlayMusic = levenshtein('включи музыку', recognizedCommand);
            const distanceSendMessage = levenshtein('отправь сообщение', recognizedCommand);
            const distanceShutdownComputer = levenshtein('выключи компьютер', recognizedCommand);
            const distanceThanks = levenshtein('спасибо', recognizedCommand);
            const similarityOpenDoor = 1 - distanceOpenDoor / Math.max('открой дверь'.length, recognizedCommand.length);
            const similarityAboutMe = 1 - distanceAboutMe / Math.max('расскажи о себе'.length, recognizedCommand.length);
            const similarityOpenBrowser = 1 - distanceOpenBrowser / Math.max('открой браузер'.length, recognizedCommand.length);
            const similarityPlayMusic = 1 - distancePlayMusic / Math.max('включи музыку'.length, recognizedCommand.length);
            const similaritySendMessage = 1 - distanceSendMessage / Math.max('отправь сообщение'.length, recognizedCommand.length);
            const similarityShutdownComputer = 1 - distanceShutdownComputer / Math.max('выключи компьютер'.length, recognizedCommand.length);
            const similarityThanks = 1 - distanceThanks / Math.max('спасибо'.length, recognizedCommand.length);
            console.log(`Совпадение с командой "открой дверь": ${similarityOpenDoor.toFixed(2)}`);
            console.log(`Совпадение с командой "расскажи о себе": ${similarityAboutMe.toFixed(2)}`);
            console.log(`Совпадение с командой "открой браузер": ${similarityOpenBrowser.toFixed(2)}`);
            console.log(`Совпадение с командой "включи музыку": ${similarityPlayMusic.toFixed(2)}`);
            console.log(`Совпадение с командой "отправь сообщение": ${similaritySendMessage.toFixed(2)}`);
            console.log(`Совпадение с командой "выключи компьютер": ${similarityShutdownComputer.toFixed(2)}`);
            console.log(`Совпадение с командой "спасибо": ${similarityThanks.toFixed(2)}`);

            if (similarityOpenDoor >= COMMAND_THRESHOLD) {
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
            else if (similarityOpenBrowser >= COMMAND_THRESHOLD){
                const doneRandomIndex = Math.floor(Math.random() * doneAudioFilePaths.length);
                const doneSelectedAudioFilePath = doneAudioFilePaths[doneRandomIndex];
                player.play(doneSelectedAudioFilePath, function(err){
                    if (err) {
                      console.error('Ошибка воспроизведения:', err);
                    } else {
                      console.log('Аудиофайл успешно воспроизведен');
                    }
                    });
                    micInstance.stop();
                    startWakeWordDetection();
                url = 'https://www.youtube.com';
                exec(`xdg-open ${url}`, (error, stdout, stderr) => {
                    if (error) {
                      console.error(`Ошибка при открытии браузера: ${error.message}`);
                      return;
                    }
                    console.log(`Стандартный вывод: ${stdout}`);
                    console.error(`Стандартный вывод ошибки: ${stderr}`);
                  });
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
