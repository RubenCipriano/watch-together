var videoPlayer = $('video')[0];
var playButtonVideoPlayer = $('.player-button-mobile')[0];
var playButtonControls = $('.player-button-desktop')[0];
var playerVolume = $('.player-volume')[0]
var defaultVolume = localStorage.getItem('volume');
var socket = io();
var lobbyId = window.location.pathname.split('/')[2];
var lobbyAdminId = window.location.pathname.split('/')[3];

$(document).ready(function() {
    socket.emit('lobby-id', lobbyId);

    playerVolume.value = videoPlayer.volume = defaultVolume;
    videoPlayer.volume = defaultVolume;

    socket.on('pause', (timeStamp) => {
        if(playButtonControls) playButtonControls.innerHTML = '<i class="fa-solid fa-play"></i>'
        if(playButtonVideoPlayer) playButtonVideoPlayer.innerHTML = '<i class="fa-solid fa-pause"></i>'
        videoPlayer.pause();
        videoPlayer.currentTime = timeStamp;
    })

    socket.on('play', () => {
        if(playButtonControls) playButtonControls.innerHTML = '<i class="fa-solid fa-pause"></i>'
        if(playButtonVideoPlayer) playButtonVideoPlayer.innerHTML = '<i class="fa-solid fa-play"></i>'
        videoPlayer.play();
    })

    socket.on('change', (videoEp) => {
        $('.loading')[0].classList.add('show')
        if(!videoEp.animeStreamUrl.endsWith('mp4')) changeSource(videoEp.animeStreamUrl, socket, lobbyId)
        else videoPlayer.currentSrc = videoEp.animeStreamUrl;
        animeShowInfo = videoEp.episode;
    })

    socket.on('exit', () => {
        location.pathname = ""
    })

    $('.anime-ep').click((anime) => {
        $('.loading')[0].classList.add('show')
        socket.emit('change', {id: lobbyId, episodeId: anime.target.attributes.value.nodeValue})
    })

    if(!videoPlayer.currentSrc.endsWith('mp4')) {
        changeSource(videoPlayer.currentSrc, socket, lobbyId)
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
    playButtonVideoPlayer.classList.remove('hidden');

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

    setTimeout(() => {
        playButtonVideoPlayer.classList.add('hidden');
    }, 500)
}

videoPlayer.addEventListener('timeupdate', () => {
    socket.emit('currentTime', {id: lobbyId, currentTime: videoPlayer.currentTime })
})