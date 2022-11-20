var videoPlayer = $('video')[0];
var playButtonVideoPlayer = $('.player-button-mobile')[0];
var playButtonControls = $('.play-button')[0];
var playerVolume = $('.player-volume')[0]
var defaultVolume = localStorage.getItem('volume');
var playerControls = $('.player-controls')[0];
var fullscreenButton = $('.fullscreen')[0];

var socket = io();
var lobbyId = window.location.pathname.split('/')[2];

$(document).ready(function() {
    socket.emit('lobby-id', lobbyId);

    playerVolume.value = videoPlayer.volume = defaultVolume;
    videoPlayer.volume = defaultVolume;

    socket.on('pause', (timeStamp) => {
        if(playButtonControls) playButtonControls.innerHTML = '<i class="fa-solid fa-play"></i>'
        if(playButtonVideoPlayer) playButtonVideoPlayer.innerHTML = '<i class="fa-solid fa-pause"></i>'
        if(!socket.changing) changePlay(false)
        videoPlayer.pause();
        videoPlayer.currentTime = timeStamp;
    })

    socket.on('play', () => {
        if(playButtonControls) playButtonControls.innerHTML = '<i class="fa-solid fa-pause"></i>'
        if(playButtonVideoPlayer) playButtonVideoPlayer.innerHTML = '<i class="fa-solid fa-play"></i>'
        changePlay(false)
        videoPlayer.play();
    })

    socket.on('change', (videoEp) => {
        videoPlayer.pause();
        $('.loading')[0].classList.add('show')
        if(!videoEp.animeStreamUrl.endsWith('mp4')) changeSource(videoEp.animeStreamUrl, socket)
        else videoPlayer.currentSrc = videoEp.animeStreamUrl;
        animeShowInfo = videoEp.episode;
    })

    socket.on('exit', () => {
        location.pathname = ""
    })

    $('.anime-ep').click((anime) => {
        socket.changing = true;
        $('.loading')[0].classList.add('show')
        socket.emit('change', {id: lobbyId, episodeId: anime.target.attributes.value.nodeValue})
    })

    if(!videoPlayer.currentSrc.endsWith('mp4')) {
        changeSource(videoPlayer.currentSrc, socket)
        videoPlayer.currentTime = animeShowInfo.currentTime || 0;
        if(animeShowInfo.paused == false) videoPlayer.play();
    }
})

playerVolume.addEventListener('mousemove', (e) => {
    videoPlayer.volume = e.target.value;
    localStorage.setItem('volume', e.target.value);
})

function clickButton(button) {
    if(!button && playButtonVideoPlayer) return playButtonVideoPlayer.click();

    changePlay(true)
}

function changePlay(sendSocket) {
    if(playButtonVideoPlayer) {
        playButtonVideoPlayer.classList.remove('hidden');

        if(playButtonControls) {
            if(playButtonControls.innerHTML.trim() == '<i class="fa-solid fa-play"></i>') {
                playButtonControls.innerHTML = '<i class="fa-solid fa-pause"></i>'
                playButtonVideoPlayer.innerHTML = '<i class="fa-solid fa-play"></i>'
                videoPlayer.play();
                if(sendSocket) socket.emit('play', lobbyId)
            } else {
                playButtonControls.innerHTML = '<i class="fa-solid fa-play"></i>'
                playButtonVideoPlayer.innerHTML = '<i class="fa-solid fa-pause"></i>'
                videoPlayer.pause();
                if(sendSocket) socket.emit('pause', {id: lobbyId, timestamp: videoPlayer.currentTime})
            }
        }

        hideCursorTimeout = setTimeout(() => {
            videoFrame.style.cursor = 'none';
            playerControls.style.opacity = 0;
        }, 2000)

        setTimeout(() => {
            playButtonVideoPlayer.classList.add('hidden');
        }, 500)
    }
}

videoPlayer.addEventListener('timeupdate', () => {
    socket.emit('currentTime', {id: lobbyId, currentTime: videoPlayer.currentTime })
})

let videoFrame = $('.vidFrame')[0];
let hideCursorTimeout = null;

fullscreenButton.addEventListener('click', () => {
    if(fullscreenButton.classList.contains('fullscreen')) {
        if (videoFrame.requestFullScreen) {
            videoFrame.requestFullScreen();
        } else if (videoFrame.webkitRequestFullScreen) {
            videoFrame.webkitRequestFullScreen();
        } else if (videoFrame.mozRequestFullScreen) {
            videoFrame.mozRequestFullScreen();
        } else if(videoFrame.msRequestFullscreen) {
            videoFrame.msRequestFullscreen();
        }

        var hideCursorTimeout = setTimeout(() => {
            playerControls.style.opacity = 0;
            videoFrame.style.cursor = 'none';
        }, 5000)
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
})

videoFrame.addEventListener('mousemove', () => {
    if(hideCursorTimeout) clearInterval(hideCursorTimeout)
    videoFrame.style.cursor = 'default'
    playerControls.style.opacity = 1;
    
    if(!videoPlayer.paused) {
        hideCursorTimeout = setTimeout(() => {
            videoFrame.style.cursor = 'none';
            playerControls.style.opacity = 0;
        }, 5000)
    }
})

document.addEventListener('webkitfullscreenchange', function(e) {
	let isFullscreen = fullscreenButton.classList.contains('fullscreen');
    fullscreenButton.classList.toggle('fullscreen');
    if(isFullscreen) fullscreenButton.innerHTML = '<i class="fa-solid fa-compress"></i>'
    else fullscreenButton.innerHTML = '<i class="fa-solid fa-expand"></i>'
});

document.addEventListener('mozfullscreenchange', function(e) {
	let isFullscreen = fullscreenButton.classList.contains('fullscreen');
    fullscreenButton.classList.toggle('fullscreen');
    if(isFullscreen) fullscreenButton.innerHTML = '<i class="fa-solid fa-compress"></i>'
    else fullscreenButton.innerHTML = '<i class="fa-solid fa-expand"></i>'
});

document.addEventListener('fullscreenchange', function(e) {
	let isFullscreen = fullscreenButton.classList.contains('fullscreen');
    fullscreenButton.classList.toggle('fullscreen');
    if(isFullscreen) fullscreenButton.innerHTML = '<i class="fa-solid fa-compress"></i>'
    else fullscreenButton.innerHTML = '<i class="fa-solid fa-expand"></i>'
});