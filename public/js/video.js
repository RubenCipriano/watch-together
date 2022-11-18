$(document).ready(function() {
    if(Hls.isSupported()) {
        var lobbyId = window.location.pathname.substring(1);
    
        var video = document.getElementById('video');
        var hls = new Hls();
    
        hls.loadSource(video.currentSrc);
        hls.attachMedia(video);
    
        var socket = io();
        socket.emit('lobby-id', lobbyId);
    
        var paused = true;
    
        $(video).on('pause', () => {
            socket.emit('pause', {id: lobbyId, timestamp: video.currentTime})
        })
    
        $(video).on('play', () => {
            socket.emit('play', lobbyId)
        })
    
        socket.on('pause', (timeStamp) => {
            video.pause();
            video.currentTime = timeStamp;
        })
    
        socket.on('play', () => {
            video.play();
        })
    }
})

function getCookie(cookieName) {
    let cookie = {};
    document.cookie.split(';').forEach(function(el) {
      let [key,value] = el.split('=');
      cookie[key.trim()] = value;
    })
    return cookie[cookieName];
  }