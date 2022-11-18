$(document).ready(function() {
    if(Hls.isSupported()) {
        var lobbyId = getCookie('id') || window.location.pathname.split('/')[2];

        if(!video.currentSrc.endsWith('mp4')) changeSource(video.currentSrc)
    
        var socket = io();
        socket.emit('lobby-id', lobbyId);
    
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
            console.log("OLA")
            video.play();
        })

        socket.on('change', (videoEp) => {
            if(!videoEp.endsWith('mp4')) changeSource(videoEp)
            else video.currentSrc = videoEp;
        })

        socket.on('exit', () => {
            location.pathname = ""
        })

        $('.anime-ep').click((anime) => {
            socket.emit('change', {id: lobbyId, episodeId: anime.target.attributes.value.nodeValue})
        })
    }
})

function changeSource(source) {
    let vid = document.getElementById('video');
    if (this.hls) { this.hls.destroy(); }
    this.hls = new Hls();
    this.hls.loadSource(source);
    this.hls.attachMedia(vid);
    this.hls.on(Hls.Events.MANIFEST_PARSED, () => { });
}

function getCookie(cookieName) {
    let cookie = {};
    document.cookie.split(';').forEach(function(el) {
      let [key,value] = el.split('=');
      cookie[key.trim()] = value;
    })
    return cookie[cookieName];
  }