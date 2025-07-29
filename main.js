require('dotenv').config();
const { FFmpeg } = require('prism-media');
FFmpeg.getInfo = () => ({ command: 'C:/Users/emene/ffmpeg/bin/ffmpeg.exe' }); // Replace with your actual FFmpeg path

const { Client } = require("discord.js-selfbot-v13");
const client = new Client();
// const guild = client.guilds.cache.get("775108592168075294"); // Replace with your guild ID



const token = process.env.DISCORD_TOKEN;

client.on("ready", async () => {
    // const channel = guild.channels.cache.get(1307099165460791388);
    console.log(`${client.user.username} is ready!`);
    client.voice
      .joinChannel("775108592168075298")
      .then((connection) => connection.createStreamConnection())
      .then((connection) => {
        const videoPath = "C:/Users/emene/Desktop/A king.mp4";

        function playVideoLoop() {
          const dispatcher = connection.playVideo(videoPath, {
            fps: 30,
            bitrate: 2000,
          });

          const dispatcher2 = connection.playAudio(videoPath);

          Promise.all([
            new Promise((resolve) => {
              dispatcher.on("start", () => {
                console.log("Video is ready to play!");
                resolve();
              });
            }),
            new Promise((resolve) => {
              dispatcher2.on("start", () => {
                console.log("Audio is ready to play!");
                resolve();
              });
            }),
          ]).then(() => {
            console.log("Both video and audio are playing.");
          });

          dispatcher.on("finish", () => {
            // Pause for 2 seconds before restarting the loop
            setTimeout(() => {
              playVideoLoop();
            }, 2000); // 2000ms = 2 seconds
          });

          dispatcher.on("error", (error) => {
            console.error(`Error playing video: ${error.message}`);
          });
        }

        playVideoLoop(); // Start the loop
      });
});

client.login(token);


