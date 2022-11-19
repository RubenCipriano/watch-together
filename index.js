const express = require('express');
const app = express();
const axios = require('axios');
const cookieParser = require("cookie-parser");
const bodyParser = require('body-parser');
const http = require('http');
const crypto = require('crypto')
const fs = require('fs')


const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// -------------------------------------------------------------------------
const PORT = process.env.PORT || 10000
const API = "https://api.consumet.org/anime/enime";
// -------------------------------------------------------------------------

// set the view engine to ejs
app.set('view engine', 'ejs');

app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

app.use(cookieParser());
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

var lobbies = new Map();
var animes = null;

app.get('/', async (req, res) => {
    var lobbiesArray = []

    lobbies.forEach((lobby, key) => {
        var obj = {}
        if(lobby.animeName) obj.title = lobby.animeName;
        if(lobby.episode) obj.episode = lobby.episode.title;
        if(lobby.sockets) obj.size = lobby.sockets.length;
        if(lobby.episodes) obj.episodeCount = lobby.episodes.length;
        obj.id = key;
        
        lobbiesArray.push(obj)
    })
    res.render('home/home', {lobbies: lobbiesArray})
})

app.get('/search', async (req, res) => {
    if(!req.query.selected) {
        var animeSearched = await searchAnime(req.query.search);
        if(animeSearched.length == 1) {
            var adminPassword = generateId();
            var lobbyId = generateId();
            lobbies.set(lobbyId, { animeName: req.query.search, animeId: animeSearched[0].id, adminPassword: adminPassword })
            res.redirect(`/lobby/${lobbyId}/${adminPassword}`)
        } else {
            res.render('home/home', { animes: animeSearched })
        }
    } else {
        var adminPassword = generateId();
        var lobbyId = generateId();
        lobbies.set(lobbyId, {animeId: req.query.selected,animeName: req.query.search, adminPassword: adminPassword})
        res.redirect(`/lobby/${lobbyId}/${adminPassword}`)
    }
})

app.get('/lobby/:lobby/', (req, res) => res.redirect(`/lobby/${req.params.lobby}/spectate`))


app.get('/lobby/:lobby/:admin', async (req, res) => {
    var animeLobbyAdmin = lobbies.get(req.params.lobby);

    if(!animeLobbyAdmin) return res.redirect('/')

    if(animeLobbyAdmin.adminPassword != req.params.admin) {
        if(req.params.admin == 'spectate') {
            axios({method: 'get', url: `${API}/watch?episodeId=${animeLobbyAdmin.episode.id}`, timeout: 10000}).then((response2) => {
                res.render('video/video', { animeEp: response2.data.sources[0].url, animeShowInfo: animeLobbyAdmin.episode })
            }).catch((err) => {
                lobbies.delete(req.params.lobby)
                res.redirect('/')
            });
        } else {
            res.redirect(`/lobby/${req.params.lobby}/spectate`)
        }
    } else {
        if(animeLobbyAdmin.animeId) {
            var animeDetails = await getAnimeDetails(animeLobbyAdmin.animeId);
            if(animeDetails) {
                animeLobbyAdmin.episodes = animeDetails.episodes
                animeLobbyAdmin.episode = animeDetails.episodes[0]
            }
        }
        axios({method: 'get', url: `${API}/watch?episodeId=${animeLobbyAdmin.episode.id}`, timeout: 10000}).then((response2) => {
            res.render('video/video', { animeEp: response2.data.sources[0].url, animeEps: animeLobbyAdmin.episodes, animeShowInfo: animeLobbyAdmin.episode })
        }).catch((err) => {
            lobbies.delete(req.params.lobby)
            res.redirect('/')
        });
    }
})

app.get('/random', async (req, res) => {
    if(animes == null) animes = fs.readFileSync('anime-offline-database.json')

    var randomLobbyId = generateId();
    var randomAdminId = generateId();

    var allAnimes = JSON.parse(animes).data;

    var animeSearched = []

    while(animeSearched.length == 0) {
        var randomAnime = allAnimes[between(0, allAnimes.length)];
        animeSearched = await searchAnime(randomAnime.title);
    }

    var animeDetails = await getAnimeDetails(animeSearched[between(0, animeSearched.length)].animeId);
    lobbies.set(randomLobbyId, {adminPassword: randomAdminId, episodes: animeDetails.episodesList, episode: animeDetails.episodesList[0].episodeId, sockets: []})
    
    res.send({lobby: randomLobbyId, data: lobbies.get(randomLobbyId)})

    if(req.query.closetime) {
        setTimeout(() => {
            var lobby = lobbies.get(randomLobbyId);
            lobby.sockets.forEach((socket) => socket.emit('exit'));

        }, req.query.closetime);
    }


    if(req.query.starttime) {
        setTimeout(() => {
            var lobby = lobbies.get(randomLobbyId);
            lobby.sockets.forEach((socket) => socket.emit('play'));
            console.log("Começou o cinema!")
        }, req.query.starttime);
    }
})

io.on('connection', (socket) => {
    socket.on('lobby-id', (id) => {
        var animeLobby = lobbies.get(id);
        if(animeLobby) {
            if(animeLobby.sockets) animeLobby.sockets.push(socket);
            else animeLobby.sockets = [socket]
        }
    });

    socket.on('pause', (idTimestamp) => {
        var animeLobby = lobbies.get(idTimestamp.id);

        if(animeLobby.sockets) {
            animeLobby.sockets.forEach((viewer) => {
                viewer.emit('pause', idTimestamp.timestamp);
            })
        }
    })

    socket.on('play', (id) => {
        var animeLobby = lobbies.get(id);
        if(animeLobby.sockets) {
            animeLobby.sockets.forEach((viewer) => {
                viewer.emit('play', id);
            })
        }
    })

    socket.on('change', async (idChange) => {
        var animeLobby = lobbies.get(idChange.id);
        await changeLobbyEpisode(idChange.id, idChange.episodeId)
        if(animeLobby.sockets) {
            animeLobby.sockets.forEach((viewer) => {
                viewer.emit('pause', 0);
                axios({method: 'get', url: `${API}/watch?episodeId=${idChange.episodeId}`, timeout: 10000}).then((response2) => {
                    viewer.emit('change', {streamUrl: response2.data.sources[0].url, episode: animeLobby.episode });
                }).catch((err) => {
                    console.log(err)
                    socket.emit('exit')
                });
            })
        }
    })

    socket.on('disconnect', () => {
        lobbies.forEach((lobby, key) => {
            if(!lobby.sockets) return lobbies.delete(key)
            var foundedSocketIndex = lobby.sockets.findIndex((s) => s == socket)
            if(foundedSocketIndex >= 0) {
                lobby.sockets.splice(foundedSocketIndex, 1)
                if(lobby.sockets.length == 0) lobbies.delete(key);
            }
        })
    })
});

function between(min, max) {  
    return Math.floor(
      Math.random() * (max - min) + min
    )
}

async function searchAnime(animeString) {
    try {
        var response = await axios({ method: 'get', url: `${API}/${animeString}`, timeout: 5000 })
        return response.data.results;
    }   
    catch(err) {
        console.log(err)
        return null;
    }
}


async function getAnimeDetails(animeId) {
    try {
        var response = await axios({method: 'get', url: `${API}/info?id=${animeId}`, timeout: 5000})
        return response.data;
    } catch(err) {
        console.log(err)
        return null;
    }
}
 
// generateId :: Integer -> String
function generateId (len) {
    return crypto.randomBytes(20).toString('hex');
}

async function changeLobbyEpisode(id, episode) {
    var animeLobby = lobbies.get(id);
    animeLobby.episode = animeLobby.episodes.find((ep) => ep.id == episode)
}

server.listen(PORT, () => console.log(`Listen to ${PORT}`))

module.exports = server;