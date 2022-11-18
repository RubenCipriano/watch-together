const express = require('express');
const app = express();
const axios = require('axios');
const cookieParser = require("cookie-parser");
const bodyParser = require('body-parser');
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);


const PORT = process.env.PORT || 8080
const API = "https://gogoanime.consumet.org";

// set the view engine to ejs
app.set('view engine', 'ejs');

app.use(express.static(__dirname + '/public'));

app.use(cookieParser());
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

var lobbies = new Map();

app.get('/', async (req, res) => {
    if(req.query.search) {
        axios({ 
            method: 'get', url: `${API}/search?keyw=${req.query.search}`
        }).then((response) => {
            if(response.data.length == 1) {
                lobbies.set(req.cookies.id, response.data[0].animeId)
                res.redirect(`${req.cookies.id}`)
            }
    
            res.render('home/home', {animes: response.data})
        });
    } else {
        if(req.query.selected) {
            lobbies.set(req.cookies.id, req.query.selected)
            res.redirect(`${req.cookies.id}`)
        } else {
            res.render('home/home')
        }
    }
})

app.get('/:lobby', async (req, res) => {
    var searchAnime = lobbies.get(req.params.lobby);
    if(searchAnime) {
        typeof searchAnime == 'string' ? searchAnime = searchAnime : searchAnime = searchAnime.anime;
        axios({method: 'get', url: `${API}/anime-details/${searchAnime}`}).then((response) => {
            axios({method: 'get', url: `${API}/vidcdn/watch/${response.data.episodesList[0].episodeId}`}).then((response2) => {
                res.render('video/video', { animeEps: response.data.episodesList, animeEp: response2.data.sources[0].file })
            })
        })
    }
})

io.on('connection', (socket) => {
    socket.on('lobby-id', (id) => {
        var animeLobby = lobbies.get(id);
        if(typeof animeLobby == 'string') {
            lobbies.set(id, {anime: animeLobby, sockets: [socket]});
        } else {
            animeLobby.sockets.push(socket);
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
});

server.listen(PORT, () => console.log(`Listen to ${PORT}`))