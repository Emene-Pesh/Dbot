import 'dotenv/config';
import { Client } from "discord.js-selfbot-v13";
import { Streamer, prepareStream, playStream, Utils } from '@dank074/discord-video-stream';

// Override console.log to filte            message.reply(`🎬 **Switched to Season:** ${foundSeason} in ${currentShow}\n▶️ Use \`$start\` to begin playing`);           message.reply(`🎬 **Switched to Season:** ${foundSeason} in ${currentShow}\n▶️ Use \`$start\` to begin playing`); out unwanted logs
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;

console.log = (...args) => {
    const message = args.join(' ');
    // Filter out demux:format logs
    if (message.includes('INFO demux:format') || 
        message.includes('demux:format') ||
        message.includes('Found video stream')) {
        return; // Don't log these messages
    }
    originalConsoleLog(...args);
};

console.info = (...args) => {
    const message = args.join(' ');
    // Filter out demux:format logs
    if (message.includes('INFO demux:format') || 
        message.includes('demux:format') ||
        message.includes('Found video stream')) {
        return; // Don't log these messages
    }
    originalConsoleInfo(...args);
};

async function main() {
    const streamer = new Streamer(new Client());
    await streamer.client.login(process.env.DISCORD_TOKEN);
    await streamer.joinVoice(process.env.GUILD_ID, process.env.CHANNEL_ID);

    // Get text channel for sending video titles
    const textChannel = streamer.client.channels.cache.get("1307099165460791388");
    if (!textChannel) {
        console.warn("Text channel not found. Make sure TEXT_CHANNEL_ID is set in your .env file");
    }

    // Hierarchical video structure: Shows -> Seasons -> Episodes
    const videoLibrary = {
        "Show 1": {
            "Season 1": [
                "C:/Users/admin/Desktop/A king.mp4",
                "C:/Users/admin/Desktop/burgers_on_my_mind.mp4",
                "C:/Users/admin/Desktop/carrib_cookie.mp4"
            ],
            "Season 2": [
                "C:/Users/admin/Desktop/changing_your_name.mp4",
                "C:/Users/admin/Desktop/claynut.mp4",
                "C:/Users/admin/Desktop/Italian food.mp4"
            ]
        },
        "Show 2": {
            "Season 1": [
                "C:/Users/admin/Desktop/me_and_grandma.mp4",
                "C:/Users/admin/Desktop/OddClappas.mp4",
                "C:/Users/admin/Desktop/We sucking dick.mp4"
            ]
        },
    };

    // Current active playlist
    let currentShow = "Show 1";
    let currentSeason = "Season 1";
    let videoList = videoLibrary[currentShow][currentSeason];

    // Function to extract video title from file path
    function getVideoTitle(filePath) {
        const fileName = filePath.split('/').pop().split('\\').pop(); // Handle both / and \ separators
        const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, ""); // Remove file extension
        return ` ${nameWithoutExtension}`;
    }

    let videoCount = 0;
    let currentVideoIndex = 0;
    let currentController = null; // Add this to track the current controller
    let isPlaying = true; // Add flag to control if the loop should continue
    let isJumping = false; // Add flag to prevent auto-progression during jumps

    // Help reminder system
    function sendHelpReminder() {
        if (textChannel) {
            textChannel.send("💡 **Tip:** Use `$help` to see all available commands!");
        }
    }

    // Send initial help message on boot
    setTimeout(() => {
        if (textChannel) {
            textChannel.send("🤖 **Bot Started!** Use `$help` to see list of commands.");
        }
    }, 3000); // Wait 3 seconds after boot

    // Set up 20-minute help reminders
    setInterval(sendHelpReminder, 20 * 60 * 1000); // 20 minutes in milliseconds

    streamer.client.on('messageCreate', async (message) => {
        if (message.content === "$help") {
            // Comprehensive help command
            const helpText = `
🤖 **Video Streaming Bot Commands**

**📚 Library Navigation:**
\`$library\` - Show all shows and seasons with quick jump commands
\`$library detailed\` - Show every episode with individual jump commands
\`$show [name]\` - Switch to a different show (no spaces, e.g. Show1)
\`$season [number]\` - Switch to a different season (number only, e.g. 1)
\`$playlist\` - Show current season episodes

**▶️ Playback Controls:**
\`$start\` - Start/resume video playback
\`$stop\` - Stop video playback completely
\`$skip [number]\` - Jump to specific episode (e.g. \`$skip 3\`)
\`$jump [title]\` - Jump to episode by name in current season
\`$jump [show] [season]\` - Jump to first episode (e.g. \`$jump Show1 2\`)
\`$jump [show] [season] [episode]\` - Jump to specific episode
\`$jump [show] [season] [number]\` - Jump by episode number

**📖 Examples:**
\`$library\` → See all shows with copy-ready jump commands
\`$library detailed\` → See every episode with individual commands
\`$show Show1\` → Switch to Show1 (no spaces)
\`$season 1\` → Switch to Season 1 (number only)
\`$playlist\` → See current episodes
\`$skip 2\` → Jump to episode 2
\`$jump claynut\` → Jump to episode "claynut" in current season
\`$jump Show1 2\` → Jump to Show1, Season 2, Episode 1
\`$jump Show1 2 3\` → Jump to Show1, Season 2, Episode 3
\`$jump Show2 1 claynut\` → Jump to specific episode by name

**🎬 Current Context:**
**Show:** ${currentShow}
**Season:** ${currentSeason}
**Episode:** ${currentVideoIndex + 1}/${videoList.length}
**Status:** ${isPlaying ? '▶️ Playing' : '⏹️ Stopped'}

**💡 Tip:** All commands support case-insensitive matching for shows and seasons.`;

            textChannel.send(helpText);
        }
        if (message.content === "$library") {
            // Show the entire video library structure with copy-ready commands
            let libraryText = "📚 **Video Library with Commands:**\n\n";
            Object.keys(videoLibrary).forEach(show => {
                const isCurrentShow = show === currentShow ? "▶️ " : "   ";
                const showClean = show.replace(/\s+/g, '');
                const firstSeasonNumber = Object.keys(videoLibrary[show])[0].match(/\d+/)?.[0] || '1';
                libraryText += `${isCurrentShow}**${show}**\n`;
                libraryText += `     🎯 \`$jump ${showClean} ${firstSeasonNumber}\` - Start from beginning\n`;
                
                Object.keys(videoLibrary[show]).forEach(season => {
                    const isCurrentSeason = show === currentShow && season === currentSeason ? "  ▶️ " : "     ";
                    const episodeCount = videoLibrary[show][season].length;
                    const seasonNumber = season.match(/\d+/)?.[0] || '1';
                    libraryText += `${isCurrentSeason}${season} (${episodeCount} episodes)\n`;
                    libraryText += `       🎯 \`$jump ${showClean} ${seasonNumber}\` - Start ${season}\n`;
                });
                libraryText += "\n";
            });
            libraryText += `**Current:** ${currentShow} → ${currentSeason}\n`;
            libraryText += `💡 **Copy any command above and paste it to jump directly!**`;
            textChannel.send(libraryText);
        }
        if (message.content === "$library detailed") {
            // Show detailed library with episode-by-episode commands
            let detailedText = "📚 **Detailed Library with Episode Commands:**\n\n";
            Object.keys(videoLibrary).forEach(show => {
                const isCurrentShow = show === currentShow ? "▶️ " : "   ";
                const showClean = show.replace(/\s+/g, '');
                detailedText += `${isCurrentShow}**${show}**\n`;
                
                Object.keys(videoLibrary[show]).forEach(season => {
                    const isCurrentSeason = show === currentShow && season === currentSeason ? "  ▶️ " : "     ";
                    const seasonNumber = season.match(/\d+/)?.[0] || '1';
                    detailedText += `${isCurrentSeason}**${season}**\n`;
                    
                    videoLibrary[show][season].forEach((video, index) => {
                        const episodeTitle = getVideoTitle(video).trim();
                        const episodeNumber = index + 1;
                        
                        detailedText += `       ${episodeNumber}. ${episodeTitle}\n`;
                        detailedText += `          🎯 \`$jump ${showClean} ${seasonNumber} ${episodeNumber}\`\n`;
                    });
                    detailedText += "\n";
                });
                detailedText += "\n";
            });
            detailedText += `**Current:** ${currentShow} → ${currentSeason}, Episode ${currentVideoIndex + 1}\n`;
            detailedText += `💡 **Copy any \`$jump\` command above to jump directly to that episode!**`;
            textChannel.send(detailedText);
        }
        if (message.content.startsWith("$show ")) {
            // Switch to a different show
            const targetShow = message.content.replace('$show ', '').trim();
            
            // Find show with case-insensitive matching (remove spaces from both)
            const foundShow = Object.keys(videoLibrary).find(show => 
                show.replace(/\s+/g, '').toLowerCase() === targetShow.replace(/\s+/g, '').toLowerCase()
            );
            
            if (!foundShow) {
                const availableShows = Object.keys(videoLibrary).map(show => show.replace(/\s+/g, '')).join(', ');
                message.reply(`❌ **Show not found!** "${targetShow}"\nAvailable shows: ${availableShows}`);
                return;
            }
            
            // Stop current playback
            isPlaying = false;
            streamer.stopStream();
            if (currentController) {
                currentController.abort();
            }
            
            currentShow = foundShow; // Use the actual show name with correct casing
            // Set to first season of the new show
            currentSeason = Object.keys(videoLibrary[currentShow])[0];
            videoList = videoLibrary[currentShow][currentSeason];
            currentVideoIndex = 0; // Reset to first episode
            
            message.reply(`📺 **Switched to Show:** ${currentShow}\n🎬 **Season:** ${currentSeason}\n▶️ Use \`$start\` to begin playing`);
        }
        if (message.content.startsWith("$season ")) {
            // Switch to a different season within current show (accept season number only)
            const targetSeasonInput = message.content.replace('$season ', '').trim();
            
            // Find season by number (extract number from season names like "Season 1" -> "1")
            const foundSeason = Object.keys(videoLibrary[currentShow]).find(season => {
                const seasonNumber = season.match(/\d+/)?.[0] || '1';
                return seasonNumber === targetSeasonInput;
            });
            
            if (!foundSeason) {
                const availableSeasons = Object.keys(videoLibrary[currentShow]).map(season => season.match(/\d+/)?.[0] || '1').join(', ');
                message.reply(`❌ **Season not found!** Season "${targetSeasonInput}" in ${currentShow}\nAvailable seasons: ${availableSeasons}`);
                return;
            }
            
            // Stop current playback
            isPlaying = false;
            streamer.stopStream();
            if (currentController) {
                currentController.abort();
            }
            
            currentSeason = foundSeason;
            videoList = videoLibrary[currentShow][foundSeason];
            currentVideoIndex = 0; // Reset to first episode
            
            message.reply(`� **Switched to Season:** ${currentSeason} in ${currentShow}\n▶️ Use \`$start\` to begin playing`);
        }
        if (message.content === "$playlist") {
            // Show the current playlist
            let playlistText = `🎬 **${currentShow} → ${currentSeason}:**\n\n`;
            videoList.forEach((video, index) => {
                const title = getVideoTitle(video);
                const isCurrentVideo = index === currentVideoIndex ? "▶️ " : "   ";
                playlistText += `${isCurrentVideo}${index + 1}. ${title}\n`;
            });
            
            playlistText += `\n🔢 Use \`$skip [number]\` to jump to an episode`;
            playlistText += `\n📚 Use \`$library\` to see all shows and seasons`;
            
            textChannel.send(playlistText);
        }
        if (message.content === "$stop") {
            // Stop the entire video loop
            isPlaying = false; // Stop the loop from continuing
            streamer.stopStream();
            if (currentController) {
                currentController.abort();
            }
            console.log(`Stopped video ${currentVideoIndex + 1}: ${getVideoTitle(videoList[currentVideoIndex])}`);
            message.reply(`⏹️ **Video playback stopped!**\n📺 **Current:** ${currentShow} → ${currentSeason}\n▶️ Use \`$start\` to resume.`);
        }
        if (message.content.startsWith("$skip ")) {
            // Extract the video number to skip to
            const skipToStr = message.content.replace('$skip ', '').trim();
            const skipToNumber = parseInt(skipToStr);
            
            if (isNaN(skipToNumber) || skipToNumber < 1 || skipToNumber > videoList.length) {
                message.reply(`❌ Invalid video number! Please use a number between 1 and ${videoList.length}`);
                return;
            }
            
            const targetIndex = skipToNumber - 1;
            if (targetIndex === currentVideoIndex) {
                message.reply(`▶️ Already playing video ${skipToNumber}!`);
                return;
            }
            
            // Set the new video index and stop current video
            currentVideoIndex = targetIndex;
            console.log(`Target is ${currentVideoIndex} by user command`);

            // Stop current video using the same logic as $stop
            streamer.stopStream();
            if (currentController) {
                currentController.abort();
            }
            
            // Skip commands should also resume playback if stopped
            if (!isPlaying) {
                isPlaying = true;
                message.reply('▶️ **Resuming playback and skipping to:** ' + getVideoTitle(videoList[targetIndex]));
            } else {
                message.reply(`⏭️ **Skipping to:** ${getVideoTitle(videoList[targetIndex])}`);
            }
        }
        if (message.content.startsWith("$jump ")) {
            // Enhanced jump command: supports multiple formats
            // $jump [episode title] - Jump to episode in current season
            // $jump [show] [season] - Jump to first episode of show/season
            // $jump [show] [season] [episode] - Jump to specific show, season, and episode
            // $jump [show] [season] [episode number] - Jump using episode number
            
            const jumpArgs = message.content.replace('$jump ', '').trim().split(' ');
            
            let targetShow = currentShow;
            let targetSeason = currentSeason;
            let targetEpisode = '';
            let targetVideoList = videoList;
            let targetIndex = -1;
            
            if (jumpArgs.length === 1) {
                // Format: $jump [episode title] - Search in current season
                targetEpisode = jumpArgs[0];
                targetIndex = videoList.findIndex(video => {
                    const videoTitle = getVideoTitle(video).trim();
                    return videoTitle.toLowerCase() === targetEpisode.toLowerCase();
                });
                
                if (targetIndex === -1) {
                    message.reply(`❌ **Episode not found!** "${targetEpisode}" in ${currentShow} → ${currentSeason}\nUse \`$playlist\` to see available episodes.`);
                    return;
                }
                
            } else if (jumpArgs.length === 2) {
                // Format: $jump [show] [season] - Jump to first episode of show/season
                const inputShow = jumpArgs[0];
                const inputSeason = jumpArgs[1];
                
                // Find show with case-insensitive matching (remove spaces)
                const foundShow = Object.keys(videoLibrary).find(show => 
                    show.replace(/\s+/g, '').toLowerCase() === inputShow.replace(/\s+/g, '').toLowerCase()
                );
                
                if (!foundShow) {
                    const availableShows = Object.keys(videoLibrary).map(show => show.replace(/\s+/g, '')).join(', ');
                    message.reply(`❌ **Show not found!** "${inputShow}"\nAvailable shows: ${availableShows}`);
                    return;
                }
                
                // Find season by number
                const foundSeason = Object.keys(videoLibrary[foundShow]).find(season => {
                    const seasonNumber = season.match(/\d+/)?.[0] || '1';
                    return seasonNumber === inputSeason;
                });
                
                if (!foundSeason) {
                    const availableSeasons = Object.keys(videoLibrary[foundShow]).map(season => season.match(/\d+/)?.[0] || '1').join(', ');
                    message.reply(`❌ **Season not found!** Season "${inputSeason}" in ${foundShow}\nAvailable seasons: ${availableSeasons}`);
                    return;
                }
                
                targetShow = foundShow;
                targetSeason = foundSeason;
                targetVideoList = videoLibrary[targetShow][targetSeason];
                targetIndex = 0; // Jump to first episode
                targetEpisode = getVideoTitle(targetVideoList[targetIndex]).trim();
                
            } else if (jumpArgs.length === 3) {
                // Format: $jump [show] [season] [episode/number]
                const inputShow = jumpArgs[0];
                const inputSeason = jumpArgs[1];
                const inputEpisode = jumpArgs[2];
                
                // Find show with case-insensitive matching (remove spaces)
                const foundShow = Object.keys(videoLibrary).find(show => 
                    show.replace(/\s+/g, '').toLowerCase() === inputShow.replace(/\s+/g, '').toLowerCase()
                );
                
                if (!foundShow) {
                    const availableShows = Object.keys(videoLibrary).map(show => show.replace(/\s+/g, '')).join(', ');
                    message.reply(`❌ **Show not found!** "${inputShow}"\nAvailable shows: ${availableShows}`);
                    return;
                }
                
                // Find season by number
                const foundSeason = Object.keys(videoLibrary[foundShow]).find(season => {
                    const seasonNumber = season.match(/\d+/)?.[0] || '1';
                    return seasonNumber === inputSeason;
                });
                
                if (!foundSeason) {
                    const availableSeasons = Object.keys(videoLibrary[foundShow]).map(season => season.match(/\d+/)?.[0] || '1').join(', ');
                    message.reply(`❌ **Season not found!** Season "${inputSeason}" in ${foundShow}\nAvailable seasons: ${availableSeasons}`);
                    return;
                }
                
                targetShow = foundShow;
                targetSeason = foundSeason;
                targetVideoList = videoLibrary[targetShow][targetSeason];
                
                // Check if inputEpisode is a number or episode title
                const episodeNumber = parseInt(inputEpisode);
                if (!isNaN(episodeNumber) && episodeNumber >= 1 && episodeNumber <= targetVideoList.length) {
                    // Jump by episode number
                    targetIndex = episodeNumber - 1;
                    targetEpisode = getVideoTitle(targetVideoList[targetIndex]).trim();
                } else {
                    // Jump by episode title
                    targetEpisode = inputEpisode;
                    targetIndex = targetVideoList.findIndex(video => {
                        const videoTitle = getVideoTitle(video).trim();
                        return videoTitle.toLowerCase() === targetEpisode.toLowerCase();
                    });
                    
                    if (targetIndex === -1) {
                        message.reply(`❌ **Episode not found!** "${targetEpisode}" in ${targetShow} → ${targetSeason}\nUse \`$library\` to see available episodes.`);
                        return;
                    }
                }
                
            } else {
                message.reply(`❌ **Invalid jump format!**\nUsage:\n\`$jump [episode title]\` - Jump to episode in current season\n\`$jump [show] [season]\` - Jump to first episode of show/season\n\`$jump [show] [season] [episode]\` - Jump to specific show/season/episode\n\`$jump [show] [season] [number]\` - Jump by episode number`);
                return;
            }
            
            // Check if we're already playing this exact episode
            if (targetShow === currentShow && targetSeason === currentSeason && targetIndex === currentVideoIndex) {
                message.reply(`▶️ Already playing this episode!`);
                return;
            }
            
            // Stop current playback
            isPlaying = false;
            isJumping = true; // Prevent auto-progression
            streamer.stopStream();
            if (currentController) {
                currentController.abort();
            }
            
            // Update current context if switching show/season
            if (targetShow !== currentShow || targetSeason !== currentSeason) {
                currentShow = targetShow;
                currentSeason = targetSeason;
                videoList = targetVideoList;
            }
            
            // Set the new video index
            currentVideoIndex = targetIndex;
            console.log(`Target is ${currentVideoIndex} by user jump command`);
            
            // Send immediate feedback
            const jumpMessage = `🎯 **Jumped to:** ${currentShow} → ${currentSeason}\n🎥 **Episode ${currentVideoIndex + 1}:** ${targetEpisode}`;
            message.reply(jumpMessage);
            
            // Wait longer for current video to fully stop, then start new one
            setTimeout(() => {
                // Ensure we're still supposed to be playing and start fresh
                isJumping = false; // Re-enable auto-progression
                isPlaying = true;
                console.log('Starting new video after jump delay');
                playVideoLoop();
            }, 3000); // 3 second delay to ensure clean stop
        }
        if (message.content === "$start") {
            // Start/resume playing the video loop
            if (!isPlaying) {
                isPlaying = true;
                const currentVideo = videoList[currentVideoIndex];
                console.log(`Resuming video loop at ${currentVideoIndex + 1}: ${getVideoTitle(currentVideo)}`);
                message.reply(`▶️ **Starting playback!**\n📺 **${currentShow} → ${currentSeason}**\n🎥 **Episode ${currentVideoIndex + 1}:** ${getVideoTitle(currentVideo).trim()}`);
                playVideoLoop();
            } else {
                message.reply('▶️ Video is already playing!');
            }
        }
    });

    async function playVideoLoop(index) {
        // Check if we should stop the loop
        if (!isPlaying) {
            console.log('Video loop stopped by user');
            return; // Exit the function completely
        }
        
        let command = null;
        let output = null;

        // If index is provided and valid, set currentVideoIndex
        if (typeof index === "number" && index >= 0 && index < videoList.length) {
            currentVideoIndex = index;
        }

        try {
            const controller = new AbortController();
            currentController = controller; // Store reference so $stop command can access it

            videoCount++;
            const currentVideo = videoList[currentVideoIndex];
            console.log(`Current video L139 ${currentVideoIndex}`);
            const videoTitle = getVideoTitle(currentVideo);

            console.log(`Starting video ${videoCount} (${currentVideoIndex + 1}/${videoList.length}): ${videoTitle}`);
            console.log(`Current video L143 ${currentVideoIndex}`);
            
            // Send video title to text channel
            if (textChannel) {
                try {
                    await textChannel.send(`� **${currentShow} → ${currentSeason}**\n🎥 **Episode ${currentVideoIndex + 1}:** ${videoTitle.trim()}\n`);
                } catch (msgError) {
                    console.error("Failed to send message to text channel:", msgError.message);
                }
            }

            const streamData = prepareStream(currentVideo, {
                height: 1080,
                frameRate: 30,
                bitrateVideo: 5000,
                bitrateVideoMax: 7500,
                videoCodec: Utils.normalizeVideoCodec("H264"),
                h26xPreset: "veryfast",
                additionalArgs: [
                    '-loglevel', 'error',
                    '-hide_banner',
                    '-nostats',
                    '-fflags', '+discardcorrupt',
                    '-analyzeduration', '1000000',
                    '-probesize', '1000000',
                    '-flush_packets', '1'
                ]
            }, controller.signal);

            command = streamData.command;
            output = streamData.output;

            command.on("error", (err, stdout, stderr) => {
                console.error("FFmpeg error:", err);
            });

            // Monitor memory usage
            const memBefore = process.memoryUsage();
            console.log(`Memory before video ${videoCount}: ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`);

            await playStream(output, streamer, {
                type: "go-live"
            });

            // Monitor memory after and force garbage collection
            const memAfter = process.memoryUsage();
            console.log(`Memory after video ${videoCount}: ${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`);

            console.log(`Finished playing video ${videoCount}. Moving to next video...`);

        } catch (e) {
            console.error(`Error in video ${videoCount}:`, e);
        } finally {
            // CRITICAL: Clean up resources
            try {
                if (output && typeof output.destroy === 'function') {
                    output.destroy();
                }
                if (command && typeof command.kill === 'function') {
                    command.kill('SIGTERM');
                }
                if (command && typeof command.destroy === 'function') {
                    command.destroy();
                }
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError.message);
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
                const memAfterGC = process.memoryUsage();
                console.log(`Memory after cleanup: ${(memAfterGC.heapUsed / 1024 / 1024).toFixed(2)} MB`);
            }

            // Move to the next video in the list (only if not jumping)
            if (currentController && !currentController.signal.aborted && !isJumping) {
                currentVideoIndex = (currentVideoIndex + 1) % videoList.length;
                
                // Check if we completed the season (looped back to episode 1)
                if (currentVideoIndex === 0) {
                    console.log(`Completed season ${currentSeason} of ${currentShow}. Looping back to episode 1.`);
                    if (textChannel) {
                        textChannel.send(`🎉 **Season Complete!** ${currentShow} → ${currentSeason}\n🔄 **Looping back to Episode 1**`);
                    }
                }
            }
            console.log(`Current video L225 ${currentVideoIndex}`);
            // Clear the controller reference since this video is done
            currentController = null;
            
            // Only continue the loop if still playing and not jumping
            if (isPlaying && !isJumping) {
                // Add a small delay to allow file descriptors to be released
                setTimeout(() => playVideoLoop(), 1000);
            } else {
                console.log('Video loop stopped - not starting next video');
            }
        }
    }

    // Start the infinite loop
    playVideoLoop();
}

main();
