$(document).ready(function() {
    if(Hls.isSupported()) {
        var lobbyId = getCookie('id') || window.location.pathname.split('/')[2];
    
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
            video.play();
        })

        socket.on('change', (videoEp) => {
            if(!videoEp.streamUrl.endsWith('mp4')) changeSource(videoEp.streamUrl)
            else video.currentSrc = videoEp.streamUrl;
            animeShowInfo = videoEp.episode;
            $('.loading')[0].classList.add('show')
        })

        socket.on('exit', () => {
            location.pathname = ""
        })

        $('.anime-ep').click((anime) => {
            $('.loading')[0].classList.add('show')
            socket.emit('change', {id: lobbyId, episodeId: anime.target.attributes.value.nodeValue})
        })

        if(!video.currentSrc.endsWith('mp4')) changeSource(video.currentSrc)
    }
})

function getTimeStamps(video) {
    console.log(`query TimeStampIdSearch {
        searchEpisodes(search:"${animeShowInfo.title}", limit:1) {
            timestamps {
                at
                type {
                    id
                    name
                }
            }
        }
    }`)

    var data = JSON.stringify({
        query: `query TimeStampIdSearch {
            searchEpisodes(search:"${animeShowInfo.title}", limit:1, sort: "createdAt") {
                timestamps {
                    at
                    type {
                        id
                        name
                    }
                }
            }
        }`
    });
    
    var config = { 
        method: 'post', 
        url: 'https://api.anime-skip.com/graphql', 
        headers: { 'X-Client-ID': 'ZGfO0sMF3eCwLYf8yMSCJjlynwNGRXWE', 'Content-Type': 'application/json' },
        data : data,
    };
    
    axios(config).then(function (response) {
        if(response.data.data.searchEpisodes.length > 0) {
            var timestamps = response.data.data.searchEpisodes[0].timestamps;
            var introTimestamp = {};

            introTimestamp.end = response.data.data.searchEpisodes[0].timestamps.find((timeStamp) => timeStamp.type.name == "Title Card").at

            for(var i = 0; i < response.data.data.searchEpisodes[0].timestamps.length; i++) {
                if(response.data.data.searchEpisodes[0].timestamps[i].at == introTimestamp.end) break
                if(response.data.data.searchEpisodes[0].timestamps[i].type.name == "Intro") {
                    introTimestamp.start = response.data.data.searchEpisodes[0].timestamps[i].at
                    break;
                }
                if(response.data.data.searchEpisodes[0].timestamps[i].type.name == "Recap") {
                    introTimestamp.start = response.data.data.searchEpisodes[0].timestamps[i].at
                    break;
                }
            }

            $('.skip-button').click(() => video.currentTime = introTimestamp.end)

            var interval = setInterval(() => {
                if(introTimestamp.start - 2 < video.currentTime && introTimestamp.end > video.currentTime) {
                    $('.skip-button')[0].classList.add('show')
                } else {
                    if(introTimestamp.end < video.currentTime) {
                        $('.skip-button')[0].classList.remove('show')
                    }
                }
            }, 2000)

            if(introTimestamp.end < video.currentTime) {
                clearInterval(interval);
            }
        }
    })
    .catch(function (error) {
        console.log(error);
    })
}

function changeSource(source) {
    let vid = document.getElementById('video');
    if (this.hls) { this.hls.destroy(); }
    this.hls = new Hls();
    this.hls.loadSource(source);
    this.hls.attachMedia(vid);
    this.hls.on(Hls.Events.BUFFER_APPENDED, () => {
        $('.loading')[0].classList.remove('show')
        getTimeStamps(video)
    })
}

function getCookie(cookieName) {
    let cookie = {};
    document.cookie.split(';').forEach(function(el) {
      let [key,value] = el.split('=');
      cookie[key.trim()] = value;
    })
    return cookie[cookieName];
  }