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


const PORT = process.env.PORT || 8080
const API = "https://gogoanime.consumet.org";
var animes = null;

var cors = require('cors');
app.use(cors());

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

// set the view engine to ejs
app.set('view engine', 'ejs');

app.use(express.static(__dirname + '/public'));

app.use(cookieParser());
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

var lobbies = new Map();

app.get('/', async (req, res) => {
    res.render('home/home')
})

app.get('/search', async (req, res) => {
    if(req.query.search) {
        var animeSearched = await searchAnime(req.query.search);
        if(animeSearched.length == 1) {
            var adminPassword = generateId();
            lobbies.set(req.cookies.id, {anime: animeSearched[0].animeId, adminPassword: adminPassword})
            res.redirect(`/lobby/${req.cookies.id}/${adminPassword}`)
        } else {
            res.render('home/home', { animes: animeSearched })
        }
    } else {
        var adminPassword = generateId();
        lobbies.set(req.cookies.id, {anime: req.query.selected, adminPassword: adminPassword})
        res.redirect(`/lobby/${req.cookies.id}/${adminPassword}`)
    }
})

app.get('/lobby/:lobby/', (req, res) => res.redirect(`/lobby/${req.params.lobby}/spectate`))


app.get('/lobby/:lobby/:admin', async (req, res) => {
    var animeLobbyAdmin = lobbies.get(req.params.lobby);

    console.log(req.params.lobby)

    if(!animeLobbyAdmin) return res.redirect('/')

    if(animeLobbyAdmin.adminPassword != req.params.admin) {
        if(req.params.admin == 'spectate') {
            axios({method: 'get', url: `${API}/vidcdn/watch/${animeLobbyAdmin.episode}`}).then((response2) => {
                res.render('video/video', { animeEp: response2.data.sources[0].file })
            })
        } else {
            res.redirect(`/lobby/${req.params.lobby}/spectate`)
        }
    } else {
        var searchAnime = animeLobbyAdmin.anime;

        if(searchAnime && !animeLobbyAdmin.episode) {
            var animeDetails = null;
            animeDetails = await getAnimeDetails(searchAnime);
            if(animeDetails) {
                animeLobbyAdmin.episodes = animeDetails.episodesList
                animeLobbyAdmin.episode = animeDetails.episodesList[0].episodeId
            }
        }
    
        var animeEpisode = animeLobbyAdmin.episode;
        axios({method: 'get', url: `${API}/vidcdn/watch/${animeEpisode}`}).then((response2) => {
            res.render('video/video', { animeEp: response2.data.sources[0].file, animeEps: animeLobbyAdmin.episodes })
        })
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
            console.log("comeca fdp")
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

    socket.on('change', (idChange) => {
        var animeLobby = lobbies.get(idChange.id);
        changeLobbyEpisode(idChange.id, idChange.episodeId)
        if(animeLobby.sockets) {
            animeLobby.sockets.forEach((viewer) => {
                viewer.emit('pause', 0);
                axios({method: 'get', url: `${API}/vidcdn/watch/${idChange.episodeId}`}).then((response2) => {
                    viewer.emit('change', response2.data.sources[0].file );
                })
            })
        }
    })
});

function between(min, max) {  
    return Math.floor(
      Math.random() * (max - min) + min
    )
}

async function searchAnime(animeString) {
    var response = await axios({ method: 'get', url: `${API}/search?keyw=${animeString}` })
    return response.data;
}


async function getAnimeDetails(animeId) {
    var response = await axios({method: 'get', url: `${API}/anime-details/${animeId}`})
    return response.data;
}
 
// generateId :: Integer -> String
function generateId (len) {
    return crypto.randomBytes(20).toString('hex');
}

function changeLobbyEpisode(id, episode) {
    var animeLobby = lobbies.get(id);

    if(typeof animeLobby == 'string') {
        animeLobby = episode;
    } else {
        animeLobby.anime = episode;
    }
}

server.listen(PORT, () => console.log(`Listen to ${PORT}`))