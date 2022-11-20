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
const PORT = process.env.PORT || 8080
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
        if(lobby.episode) obj.episode = lobby.episode.title;
        if(lobby.sockets) obj.size = lobby.sockets.length;
        if(lobby.animeDetails.title) obj.title = lobby.animeDetails.title;
        if(lobby.animeDetails.episodes) obj.episodeCount = lobby.animeDetails.episodes.length;
        if(lobby.startTime) obj.startTime = lobby.startTime;

        obj.id = key;
        
        lobbiesArray.push(obj)
    })
    res.render('home/home', {lobbies: lobbiesArray})
})

app.get('/search', async (req, res) => {
    // If there is no selected
    if(!req.query.selected) {

        // Search for animes
        searchAnime(req.query.search).then((animeSearched) => {
            
            // If we only get 1 anime from the search, we will reproduce it 
            if(animeSearched.length == 1) {

                // Creating an admin password, and a lobby id
                var adminPassword = generateId();
                var lobbyId = generateId();

                // Set the lobby id and the animeSearchId (For later use)
                lobbies.set(lobbyId, { animeSearchId: animeSearched[0].id, adminPassword: adminPassword })
                res.redirect(`/lobby/${lobbyId}/${adminPassword}`)
            } else {
                res.render('home/home', { animes: animeSearched })
            }
        }).catch(() => {
            res.redirect('/')
        })
    } else {
        // Creating an admin password, and a lobby id
        var adminPassword = generateId();
        var lobbyId = generateId();

        // Set the lobby id and the animeSearchId (For later use)
        lobbies.set(lobbyId, {animeSearchId: req.query.selected, adminPassword: adminPassword})
        res.redirect(`/lobby/${lobbyId}/${adminPassword}`)
    }
})

// Lobby redirect to lobby/spectate
app.get('/lobby/:lobby/', (req, res) => res.redirect(`/lobby/${req.params.lobby}/spectate`))


app.get('/lobby/:lobby/:admin', async (req, res) => {
    var animeLobbyAdmin = lobbies.get(req.params.lobby);

    // There is no Lobby
    if(!animeLobbyAdmin) return res.redirect('/')

    // If the animeLobbyPassword Admin is wrong we redirect the user to the spectate section, which has URL and ShowInfo (cannot change episodes)
    if(animeLobbyAdmin.adminPassword != req.params.admin) {

        // Check if is spectating, if not, redirect to spectate
        if(req.params.admin == 'spectate') {
            res.render('video/video', { animeStreamUrl: animeLobbyAdmin.animeStreamUrl, animeShowInfo: animeLobbyAdmin.episode })
        } else {
            res.redirect(`/lobby/${req.params.lobby}/spectate`)
        }
    } else {

        // Check if anime details in anime lobby
        if(!animeLobbyAdmin.animeDetails) {
            animeLobbyAdmin.animeDetails = await getAnimeDetails(animeLobbyAdmin.animeSearchId) || {};
            if(animeLobbyAdmin.animeDetails && animeLobbyAdmin.animeDetails != {}) animeLobbyAdmin.episode = animeLobbyAdmin.animeDetails.episodes[0]
        }

        // If First time entering get stream URL, else just get it from the admin
        if(!animeLobbyAdmin.animeStreamUrl) {
            axios({method: 'get', url: `${API}/watch?episodeId=${animeLobbyAdmin.episode.id}`, timeout: 10000}).then((response2) => {
                animeLobbyAdmin.animeStreamUrl = response2.data.sources[0].url
                res.render('video/video', { animeStreamUrl: animeLobbyAdmin.animeStreamUrl, animeEps: animeLobbyAdmin.animeDetails.episodes, animeShowInfo: animeLobbyAdmin.episode })
            }).catch((err) => {
                lobbies.delete(req.params.lobby)
                res.redirect('/')
            });
        } else {
            res.render('video/video', { animeStreamUrl: animeLobbyAdmin.animeStreamUrl, animeEps: animeLobbyAdmin.animeDetails.episodes, animeShowInfo: animeLobbyAdmin.episode })
        }
    }
})

// Creates a random lobby with a random anime
app.get('/random', async (req, res) => {

    // Read the anime file (MAL Animes)
    if(animes == null) animes = fs.readFileSync('anime-offline-database.json')

    // Create a random lobby Id and Admin Password
    var randomLobbyId = generateId();
    var randomAdminId = generateId();

    // Parse all the data
    var allAnimes = JSON.parse(animes).data;

    // Anime that will be getted
    var animeSearched = []

    // While anime is not getted (There is no anime in API), keep looking
    while(animeSearched.length == 0) {
        var randomAnime = allAnimes[between(0, allAnimes.length)];
        animeSearched = await searchAnime(randomAnime.title) || [];
    }

    // Get details of a random anime
    var animeDetails = await getAnimeDetails(animeSearched[between(0, animeSearched.length)].id);

    // Get the streamable url from the anime
    axios({method: 'get', url: `${API}/watch?episodeId=${animeDetails.episodes[0].id}`, timeout: 10000}).then((response2) => {
        // Set the url, adminPassword, episodes and current episode
        lobbies.set(randomLobbyId, {
            adminPassword: randomAdminId, 
            animeStreamUrl: response2.data.sources[0].url, 
            animeDetails: animeDetails, 
            episode: animeDetails.episodes[0] 
        })

        // Return Json
        res.send({lobby: randomLobbyId, data: lobbies.get(randomLobbyId)})


        // Close Time setted
        if(req.query.closetime) {
            setTimeout(() => {
                var lobby = lobbies.get(randomLobbyId);
                if(lobby.sockets) lobby.sockets.forEach((socket) => socket.emit('exit'));
                else lobbies.delete(randomLobbyId)

            }, req.query.closetime);
        }

        // Start Time setted
        if(req.query.starttime) {
            var lobby = lobbies.get(randomLobbyId);
            var newDate = new Date();
            lobby.startTime = newDate.setTime(newDate.getTime() + (req.query.starttime * 1000));

            setTimeout(() => {
                if(lobby.sockets) lobby.sockets.forEach((socket) => socket.emit('play'));
                else lobbies.delete(randomLobbyId)
                console.log("Começou o cinema!")
            }, dateDiff(lobby.startTime));
        }
        
    }).catch((err) => {
       console.log(err)
       res.send(null);
    });
})


function dateDiff(dateString) {
    return new Date(dateString).getTime() - new Date().getTime()
}

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
    animeLobby.episode = animeLobbyAdmin.animeDetails.episodes.find((ep) => ep.id == episode)
}

server.listen(PORT, () => console.log(`Listen to ${PORT}`))